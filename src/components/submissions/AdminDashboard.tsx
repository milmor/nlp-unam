'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { formatCourseDateTime } from '@/lib/datetime';
import type { Assignment, AdminSubmission, Course } from '@/types/submissions';
import ConfirmDialog from './ConfirmDialog';
import NotebookViewer from './NotebookViewer';
import UsageStats from './UsageStats';

interface EnrolledStudent {
  student_id: string;
  enrolled_at: string | null;
  profile: { email: string | null; name: string | null } | null;
}

interface Props {
  user: User;
  course: Course;
  onLogout: () => void;
  onBack: () => void;
}

type AdminTab = 'assignments' | 'students' | 'course-settings';

export default function AdminDashboard({ user, course, onLogout, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('assignments');
  const [showAddAssignmentForm, setShowAddAssignmentForm] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [signupsOpen, setSignupsOpen] = useState<boolean | null>(null);
  const [signupsToggling, setSignupsToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; title: string } | null>(null);
  const [confirmGrade, setConfirmGrade] = useState<{ assignmentId: number; assignmentTitle: string } | null>(null);

  // Course name/term inline editing
  const [courseName, setCourseName] = useState(course.name);
  const [courseTerm, setCourseTerm] = useState(course.term ?? '');
  const [savingCourse, setSavingCourse] = useState(false);

  async function saveCourse() {
    if (!courseName.trim()) return;
    const sb = getSupabase();
    if (!sb) return;
    setSavingCourse(true);
    const { error } = await sb
      .from('courses')
      .update({ name: courseName.trim(), term: courseTerm.trim() || null })
      .eq('id', course.id);
    setSavingCourse(false);
    if (error) showMsg('Failed to save course: ' + error.message, true);
  }

  // Inline assignment editing: id → { title, description, deadline }
  type EditDraft = { title: string; description: string; deadline: string };
  const [editingAssignment, setEditingAssignment] = useState<Map<number, EditDraft>>(new Map());

  function startEdit(a: Assignment) {
    const deadline = a.deadline
      ? new Date(new Date(a.deadline).getTime() - new Date().getTimezoneOffset() * 60000)
          .toISOString().slice(0, 16)
      : '';
    setEditingAssignment(prev => new Map(prev).set(a.id, {
      title: a.title,
      description: a.description ?? '',
      deadline,
    }));
    setExpandedAssignments(prev => new Set(prev).add(a.id));
  }

  function cancelEdit(id: number) {
    setEditingAssignment(prev => { const m = new Map(prev); m.delete(id); return m; });
  }

  function updateDraft(id: number, field: keyof EditDraft, value: string) {
    setEditingAssignment(prev => {
      const m = new Map(prev);
      const current = m.get(id);
      if (current) m.set(id, { ...current, [field]: value });
      return m;
    });
  }

  async function saveEdit(id: number) {
    const sb = getSupabase();
    if (!sb) return;
    const draft = editingAssignment.get(id);
    if (!draft || !draft.title.trim()) return;
    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
    };
    const { error } = await sb.from('assignments').update(payload).eq('id', id);
    if (error) return showMsg('Failed to save: ' + error.message, true);
    cancelEdit(id);
    loadData();
  }

  const BUCKET = 'student-notebooks';

  function getStoragePath(pathOrUrl: string): string {
    const marker = `/${BUCKET}/`;
    if (pathOrUrl.startsWith('https://')) {
      const idx = pathOrUrl.indexOf(marker);
      return idx !== -1 ? pathOrUrl.slice(idx + marker.length) : pathOrUrl;
    }
    return pathOrUrl;
  }

  async function loadNotebookJsonFromStorage(storagePath: string): Promise<Record<string, unknown>> {
    const sb = getSupabase();
    if (!sb) throw new Error('Not configured');
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No signed URL');
    const res = await fetch(data.signedUrl);
    if (!res.ok) throw new Error(`Storage fetch failed (${res.status})`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async function viewNotebook(pathOrUrl: string, title: string) {
    const storagePath = getStoragePath(pathOrUrl);
    setLoadingNotebook(true);
    setViewingNotebook(null);
    try {
      let json: Record<string, unknown>;
      if (API_URL && API_SECRET) {
        try {
          const res = await fetch(`${API_URL}/notebook?path=${encodeURIComponent(storagePath)}`, {
            headers: { 'x-api-key': API_SECRET },
          });
          if (res.ok) {
            json = await res.json();
          } else {
            const errText = await res.text();
            throw new Error(errText || `API ${res.status}`);
          }
        } catch (apiErr) {
          // Local dev: API often not running → "Failed to fetch". Fall back to Supabase signed URL (same as when API env is unset).
          try {
            json = await loadNotebookJsonFromStorage(storagePath);
          } catch (storageErr) {
            const a = apiErr instanceof Error ? apiErr.message : String(apiErr);
            const s = storageErr instanceof Error ? storageErr.message : String(storageErr);
            throw new Error(
              `API: ${a}. Storage fallback: ${s}.` +
                (a === 'Failed to fetch'
                  ? ' (Start the grading API locally, or remove NEXT_PUBLIC_API_URL / NEXT_PUBLIC_API_SECRET from .env.local to always use storage.)'
                  : '')
            );
          }
        }
      } else {
        json = await loadNotebookJsonFromStorage(storagePath);
      }
      setViewingNotebook({ title, notebook: json });
      setNotebookViewMode('notebook');
    } catch (e) {
      alert('Could not load notebook: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingNotebook(false);
    }
  }

  function showMsg(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function loadSignupSetting() {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('courses').select('signups_open').eq('id', course.id).single();
    if (data) setSignupsOpen(data.signups_open);
  }

  async function toggleSignups() {
    const sb = getSupabase();
    if (!sb || signupsOpen === null) return;
    setSignupsToggling(true);
    const next = !signupsOpen;
    const { error } = await sb.from('courses').update({ signups_open: next }).eq('id', course.id);
    if (!error) setSignupsOpen(next);
    else showMsg('Failed to update signup setting.', true);
    setSignupsToggling(false);
  }

  async function loadData() {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    showMsg('');
    try {
      const [assignRes, subRes] = await Promise.all([
        sb.from('assignments').select('id, title, description, deadline, reference_notebook').eq('course_id', course.id).order('id'),
        sb
          .from('submissions')
          .select(
            'id, assignment_id, notebook_url, score, feedback, created_at, verification_requested, verification_requested_at, verification_comment, student:profiles!submissions_student_id_fkey(email, name, role), assignment:assignments!fk_assignment(title, course_id)'
          )
          .order('created_at', { ascending: false }),
      ]);
      if (assignRes.error) throw assignRes.error;
      if (subRes.error) throw subRes.error;
      const courseAssignIds = new Set((assignRes.data ?? []).map(a => a.id));
      setAssignments(assignRes.data ?? []);
      setSubmissions(((subRes.data ?? []) as unknown as AdminSubmission[]).filter(s => courseAssignIds.has(s.assignment_id)));

      // Students: fetch enrollments then join profiles manually (FK goes to auth.users, not profiles)
      const enrollRes = await sb
        .from('enrollments')
        .select('student_id, enrolled_at')
        .eq('course_id', course.id)
        .order('enrolled_at', { ascending: false });
      if (enrollRes.error) {
        showMsg('Could not load students: ' + enrollRes.error.message, true);
      } else if (enrollRes.data && enrollRes.data.length > 0) {
        const ids = enrollRes.data.map(e => e.student_id);
        const profRes = await sb
          .from('profiles')
          .select('id, email, name')
          .in('id', ids);
        const profileMap = new Map((profRes.data ?? []).map(p => [p.id, p]));
        setStudents(enrollRes.data.map(e => ({
          student_id: e.student_id,
          enrolled_at: e.enrolled_at,
          profile: profileMap.get(e.student_id) ? {
            email: profileMap.get(e.student_id)!.email,
            name: profileMap.get(e.student_id)!.name,
          } : null,
        })));
      } else {
        setStudents([]);
      }
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : 'Failed to load data.', true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); loadSignupSetting(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddAssignment(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const sb = getSupabase();
    if (!sb) return;
    showMsg('Adding assignment…');
    const payload: Record<string, unknown> = { title, course_id: course.id };
    if (newDesc.trim()) payload.description = newDesc.trim();
    if (newDeadline) payload.deadline = new Date(newDeadline).toISOString();
    const { error } = await sb.from('assignments').insert([payload]);
    if (error) return showMsg('Failed to add: ' + error.message, true);
    setNewTitle('');
    setNewDesc('');
    setNewDeadline('');
    setShowAddAssignmentForm(false);
    loadData();
  }

  async function confirmDeleteAssignment() {
    if (!confirmDelete) return;
    const sb = getSupabase();
    if (!sb) return;
    setConfirmDelete(null);
    showMsg('Deleting…');
    const { error } = await sb.from('assignments').delete().eq('id', confirmDelete.id);
    if (error) return showMsg('Failed to delete: ' + error.message, true);
    showMsg('');
    loadData();
  }

  // Save score/feedback on blur — debounced with a ref timer
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function scheduleGradeSave(submissionId: number, score: number | null, feedback: string) {
    const existing = saveTimers.current.get(submissionId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { error } = await sb
        .from('submissions')
        .update({ score, feedback: feedback || null })
        .eq('id', submissionId);
      if (error) showMsg('Save failed: ' + error.message, true);
      saveTimers.current.delete(submissionId);
    }, 600);
    saveTimers.current.set(submissionId, timer);
  }

  // Local editable state for score/feedback
  const [grades, setGrades] = useState<
    Map<number, { score: string; feedback: string }>
  >(new Map());

  // Reference notebook upload & grading
  const refInputRef = useRef<HTMLInputElement>(null);
  const pendingRefAssignId = useRef<number | null>(null);
  const [gradingStatus, setGradingStatus] = useState<Map<number, string>>(new Map());
  const [gradingError, setGradingError]   = useState<Map<number, boolean>>(new Map());
  const [gradingAssignmentId, setGradingAssignmentId] = useState<number | null>(null);
  const [plagiarismThresholdPct, setPlagiarismThresholdPct] = useState(60); // 60% default to reduce false positives (similar to reference)
  const [viewingNotebook, setViewingNotebook] = useState<{ title: string; notebook: Record<string, unknown> } | null>(null);
  const [notebookViewMode, setNotebookViewMode] = useState<'notebook' | 'json'>('notebook');
  const [loadingNotebook, setLoadingNotebook] = useState(false);
  const [editingFeedbackFor, setEditingFeedbackFor] = useState<{ subId: number; feedback: string; studentLabel: string } | null>(null);

  const API_URL    = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
  const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET ?? '';

  function setGradeMsg(id: number, msg: string, isErr = false) {
    setGradingStatus(p => new Map(p).set(id, msg));
    setGradingError(p  => new Map(p).set(id, isErr));
  }

  function triggerRefUpload(assignmentId: number) {
    pendingRefAssignId.current = assignmentId;
    if (refInputRef.current) { refInputRef.current.value = ''; refInputRef.current.click(); }
  }

  async function handleRefFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const assignId = pendingRefAssignId.current;
    if (!file || assignId === null) return;
    if (!file.name.endsWith('.ipynb')) {
      setGradeMsg(assignId, 'Only .ipynb files accepted.', true); return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setGradeMsg(assignId, 'Uploading reference…');
    const path = `reference/${assignId}_reference.ipynb`;
    const { error: upErr } = await sb.storage.from('student-notebooks').upload(path, file, { upsert: true, contentType: 'application/json' });
    if (upErr) { setGradeMsg(assignId, 'Upload failed: ' + upErr.message, true); return; }
    const { error: dbErr } = await sb.from('assignments').update({ reference_notebook: path }).eq('id', assignId);
    if (dbErr) { setGradeMsg(assignId, 'DB update failed: ' + dbErr.message, true); return; }
    setGradeMsg(assignId, 'Reference uploaded ✓');
    loadData();
  }

  async function handleGradeAll(assignmentId: number, force = false) {
    if (!API_URL) { setGradeMsg(assignmentId, 'Grading service not configured.', true); return; }
    setGradeMsg(assignmentId, 'Grading in progress…');
    setGradingAssignmentId(assignmentId);
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    params.set('plagiarism_threshold', String(plagiarismThresholdPct / 100));
    try {
      const res = await fetch(`${API_URL}/grade/${assignmentId}?${params}`, {
        method: 'POST',
        headers: API_SECRET ? { 'x-api-key': API_SECRET } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Unknown error');
      const t = data.tokens_used;
      const usageStr = t && (t.prompt_tokens || t.completion_tokens)
        ? ` · ${(t.prompt_tokens || 0).toLocaleString()} in / ${(t.completion_tokens || 0).toLocaleString()} out`
        : '';
      const suffix = data.aborted ? ' (stopped)' : '';
      setGradeMsg(
        assignmentId,
        data.aborted
          ? `Stopped — ${data.graded} graded, ${data.errors} errors${usageStr}${suffix}`
          : `Done — ${data.graded} graded, ${data.errors} errors${usageStr}`,
      );
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg === 'Failed to fetch'
        ? ' — Service unreachable. Check your configuration.'
        : '';
      setGradeMsg(assignmentId, `Grading failed: ${msg}${hint}`, true);
    } finally {
      setGradingAssignmentId(null);
    }
  }

  async function handleStopGrading(assignmentId: number) {
    if (!API_URL) return;
    setGradeMsg(assignmentId, 'Stopping after current submission…');
    try {
      await fetch(`${API_URL}/grade/${assignmentId}/abort`, {
        method: 'POST',
        headers: API_SECRET ? { 'x-api-key': API_SECRET } : {},
      });
    } catch {
      setGradeMsg(assignmentId, 'Stop requested (request failed; grading may still stop).');
    }
  }

  // Accordion: which assignment rows are expanded
  const [expandedAssignments, setExpandedAssignments] = useState<Set<number>>(new Set());
  function toggleAssignment(id: number) {
    setExpandedAssignments(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  useEffect(() => {
    const initial = new Map<number, { score: string; feedback: string }>();
    for (const s of submissions) {
      initial.set(s.id, {
        score: s.score != null ? String(s.score) : '',
        feedback: s.feedback ?? '',
      });
    }
    setGrades(initial);
  }, [submissions]);

  function handleScoreChange(id: number, value: string) {
    setGrades(prev => {
      const next = new Map(prev);
      const current = next.get(id) ?? { score: '', feedback: '' };
      next.set(id, { ...current, score: value });
      const parsed = value === '' ? null : parseFloat(value);
      scheduleGradeSave(id, isNaN(parsed as number) ? null : parsed, current.feedback);
      return next;
    });
  }

  function handleFeedbackChange(id: number, value: string) {
    setGrades(prev => {
      const next = new Map(prev);
      const current = next.get(id) ?? { score: '', feedback: '' };
      next.set(id, { ...current, feedback: value });
      const score = current.score === '' ? null : parseFloat(current.score);
      scheduleGradeSave(id, isNaN(score as number) ? null : score, value);
      return next;
    });
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header admin-dashboard-header">
        <div className="dashboard-header-primary">
          <button className="btn-back-courses" onClick={onBack} type="button" aria-label="Back to courses">
            ← Courses
          </button>
          <span className="dashboard-header-sep" aria-hidden />
          <h1 className="dashboard-title">{courseName}{courseTerm ? ` · ${courseTerm}` : ''}</h1>
        </div>
        <div className="dashboard-header-actions">
          <button type="button" className="btn-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      <div className="dashboard-header-meta">
        <span className="dashboard-user-line">Logged in as <strong>{user.email}</strong></span>
        <span className="admin-badge">Admin</span>
      </div>

      {message && (
        <p className={`admin-dashboard-message${isError ? ' error' : ''}`}>{message}</p>
      )}

      <div className="admin-layout">
      <nav className="admin-nav" aria-label="Admin sections">
        {(['assignments', 'students', 'course-settings'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            className={`admin-nav-item${activeTab === tab ? ' admin-nav-item--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'assignments' && <>Assignments</>}
            {tab === 'students' && <>Students</>}
            {tab === 'course-settings' && <>Course settings</>}
            <span className="admin-nav-count">
              {tab === 'assignments' && assignments.length}
              {tab === 'students' && students.length}
              {tab === 'course-settings' && null}
            </span>
          </button>
        ))}
      </nav>

      <div className="admin-content">
      {activeTab === 'course-settings' && (
        <>
          <div className="course-settings-card">
            <div className="course-settings-section">
              <span className="course-settings-label">Edit course</span>
              <div className="course-edit-inline">
                <input
                  type="text"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  placeholder="Course name"
                  disabled={savingCourse}
                  className="course-edit-input"
                />
                <input
                  type="text"
                  value={courseTerm}
                  onChange={e => setCourseTerm(e.target.value)}
                  placeholder="Term (e.g. 2025-1)"
                  disabled={savingCourse}
                  className="course-edit-input course-edit-input--term"
                />
                <button type="button" className="btn-primary btn-small" onClick={saveCourse} disabled={savingCourse}>
                  {savingCourse ? '…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => { setCourseName(course.name); setCourseTerm(course.term ?? ''); }}
                >
                  Cancel
                </button>
              </div>
            </div>

            {signupsOpen !== null && (
              <div className="signup-toggle-row">
                <span className="signup-toggle-label">
                  New registrations:
                  <span className={`signup-status-badge${signupsOpen ? ' open' : ' closed'}`}>
                    {signupsOpen ? 'Open' : 'Closed'}
                  </span>
                </span>
                <button
                  type="button"
                  className={signupsOpen ? 'btn-secondary btn-small' : 'btn-primary btn-small'}
                  onClick={toggleSignups}
                  disabled={signupsToggling}
                >
                  {signupsToggling ? '…' : signupsOpen ? 'Close registrations' : 'Open registrations'}
                </button>
              </div>
            )}
          </div>

          <div className="detail-card submissions-api-card" style={{ marginTop: '1rem' }}>
            <UsageStats />
          </div>
        </>
      )}

      {/* Assignments: add button + form (when open) + accordion with submissions */}
      {activeTab === 'assignments' && (
        <div className="admin-assignments-section">
          <div className="admin-section-head">
            <h5 className="admin-section-title">Assignments</h5>
            {!showAddAssignmentForm && (
              <button
                type="button"
                className="btn-primary btn-small"
                onClick={() => setShowAddAssignmentForm(true)}
              >
                Add assignment
              </button>
            )}
          </div>

          {showAddAssignmentForm && (
            <form className="admin-assignment-form admin-assignment-form--new" onSubmit={handleAddAssignment}>
              <div className="admin-assignment-fields">
                <input
                  type="text"
                  placeholder="Title"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
                <input
                  type="datetime-local"
                  title="Deadline (optional)"
                  value={newDeadline}
                  onChange={e => setNewDeadline(e.target.value)}
                />
              </div>
              <div className="admin-assignment-form-actions">
                <button type="submit" className="btn-primary btn-small">Create assignment</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => { setShowAddAssignmentForm(false); setNewTitle(''); setNewDesc(''); setNewDeadline(''); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="prereq-note">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="prereq-note admin-list-empty-standalone">No assignments yet. Click “Add assignment” to create one.</p>
          ) : (
          <>
          <ul className="admin-accordion">
            {assignments.map(a => {
              const assignSubs = submissions.filter(s => s.assignment_id === a.id);
              const count = assignSubs.length;
              const isOpen = expandedAssignments.has(a.id);
              const draft = editingAssignment.get(a.id);
              const isEditing = !!draft;
              const isPast = a.deadline ? new Date(a.deadline) < new Date() : false;
              return (
                <li key={a.id} className={`admin-accordion-item${isEditing ? ' admin-accordion-item--editing' : ''}`}>
                  <div className="admin-accordion-header-row">
                    <button
                      type="button"
                      className="admin-accordion-header"
                      onClick={() => toggleAssignment(a.id)}
                    >
                      <span>
                        <strong>{a.title}</strong>
                        {a.deadline && (
                          <span className={`deadline-badge${isPast ? ' deadline-past' : ''}`}>
                            {isPast ? '⏰ Closed' : '⏰ Due'}{' '}
                            {formatCourseDateTime(a.deadline)}
                          </span>
                        )}
                        <span className="admin-accordion-count">{count} submission{count !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="admin-accordion-chevron">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    <span className="admin-accordion-actions" onClick={e => e.stopPropagation()}>
                      <button type="button" className="btn-secondary btn-small" onClick={() => startEdit(a)} title="Edit assignment">
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => triggerRefUpload(a.id)}
                        title={a.reference_notebook ? 'Replace reference notebook' : 'Upload reference notebook'}
                      >
                        {a.reference_notebook ? '📄 Ref ✓' : '📄 Ref'}
                      </button>
                      {a.reference_notebook && gradingAssignmentId !== a.id && (
                        <>
                          <label className="admin-plagiarism-threshold">
                            <span className="admin-plagiarism-threshold-label">Plag.:</span>
                            <select
                              value={plagiarismThresholdPct}
                              onChange={e => setPlagiarismThresholdPct(Number(e.target.value))}
                              title="Plagiarism threshold %"
                              className="admin-plagiarism-threshold-select"
                            >
                              <option value={40}>40%</option>
                              <option value={50}>50%</option>
                              <option value={60}>60%</option>
                              <option value={70}>70%</option>
                              <option value={80}>80%</option>
                            </select>
                          </label>
                          <button type="button" className="btn-primary btn-small" onClick={() => setConfirmGrade({ assignmentId: a.id, assignmentTitle: a.title })}>
                            ✨ Grade
                          </button>
                        </>
                      )}
                      {gradingAssignmentId === a.id && (
                        <button type="button" className="btn-danger btn-small" onClick={() => handleStopGrading(a.id)}>
                          Stop
                        </button>
                      )}
                      <button type="button" className="btn-danger btn-small" onClick={() => setConfirmDelete({ id: a.id, title: a.title })} title="Delete assignment">
                        Delete
                      </button>
                    </span>
                  </div>
                  {gradingStatus.get(a.id) && (
                    <p className={`admin-dashboard-message admin-accordion-grade-msg${gradingError.get(a.id) ? ' error' : ''}`}>
                      {gradingStatus.get(a.id)}
                    </p>
                  )}

                  {isOpen && (
                    <div className="admin-accordion-body">
                      {isEditing && draft && (
                        <div className="admin-assignment-edit-form">
                          <input
                            type="text"
                            placeholder="Title"
                            value={draft.title}
                            onChange={e => updateDraft(a.id, 'title', e.target.value)}
                            required
                          />
                          <input
                            type="text"
                            placeholder="Description (optional)"
                            value={draft.description}
                            onChange={e => updateDraft(a.id, 'description', e.target.value)}
                          />
                          <input
                            type="datetime-local"
                            title="Deadline (optional)"
                            value={draft.deadline}
                            onChange={e => updateDraft(a.id, 'deadline', e.target.value)}
                          />
                          <div className="admin-assignment-actions">
                            <button type="button" className="btn-primary btn-small" onClick={() => saveEdit(a.id)}>Save</button>
                            <button type="button" className="btn-secondary btn-small" onClick={() => cancelEdit(a.id)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    <div className="dashboard-table-wrapper admin-table-responsive">
                      <table className="dashboard-table admin-submissions-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Notebook</th>
                            <th>Score</th>
                            <th>Feedback</th>
                            <th>Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignSubs.length === 0 ? (
                            <tr><td colSpan={5} className="admin-table-empty">No submissions yet.</td></tr>
                          ) : assignSubs.map(sub => {
                            const g = grades.get(sub.id) ?? { score: '', feedback: '' };
                            const role = sub.student?.role ? ` (${sub.student.role})` : '';
                            return (
                              <tr key={sub.id}>
                                <td data-label="Student">
                                  {sub.student?.name
                                    ? <><strong>{sub.student.name}</strong>{role}</>
                                    : (sub.student?.email ?? '—') + role
                                  }
                                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    {sub.student?.email ?? ''}
                                  </span>
                                </td>
                                <td data-label="Notebook">
                                  {sub.notebook_url ? (
                                    <button
                                      type="button"
                                      className="btn-secondary btn-small"
                                      onClick={() => viewNotebook(sub.notebook_url!, sub.student?.name || sub.student?.email || 'Notebook')}
                                      disabled={loadingNotebook}
                                    >
                                      {loadingNotebook ? '…' : 'View'}
                                    </button>
                                  ) : '—'}
                                </td>
                                <td data-label="Score">
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    step={0.5}
                                    className="admin-score-input"
                                    value={g.score}
                                    onChange={e => handleScoreChange(sub.id, e.target.value)}
                                  />
                                </td>
                                <td data-label="Feedback">
                                  <div className="admin-feedback-cell">
                                    {sub.verification_requested && (
                                      <div className="verification-requested-block">
                                        <span className="verification-badge verification-requested admin-verification-badge">
                                          Verification requested
                                        </span>
                                        {sub.verification_comment && (
                                          <p className="verification-student-comment">{sub.verification_comment}</p>
                                        )}
                                      </div>
                                    )}
                                    {g.feedback ? (
                                      <span className="admin-feedback-preview" title={g.feedback}>
                                        {g.feedback.length > 55 ? g.feedback.slice(0, 55).trim() + '…' : g.feedback}
                                      </span>
                                    ) : (
                                      <span className="admin-feedback-empty">No feedback</span>
                                    )}
                                    <button
                                      type="button"
                                      className="admin-feedback-expand-btn admin-feedback-open-btn"
                                      onClick={() => setEditingFeedbackFor({
                                        subId: sub.id,
                                        feedback: g.feedback,
                                        studentLabel: sub.student?.name || sub.student?.email || `Submission ${sub.id}`,
                                      })}
                                      title="View or edit feedback"
                                    >
                                      {g.feedback ? 'View / Edit feedback' : 'Add feedback'}
                                    </button>
                                    {sub.verification_requested && (
                                      <button
                                        type="button"
                                        className="admin-feedback-expand-btn"
                                        onClick={async () => {
                                          const sb = getSupabase();
                                          if (!sb) return;
                                          await sb.from('submissions').update({ verification_requested: false, verification_requested_at: null, verification_comment: null }).eq('id', sub.id);
                                          loadData();
                                        }}
                                        title="Mark verification as resolved"
                                      >
                                        Mark resolved
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td data-label="Submitted">{formatCourseDateTime(sub.created_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="prereq-note admin-usage-note" style={{ marginTop: '0.75rem', fontSize: '0.85em' }}>
            Usage (in / out) is shown after each run.
          </p>
          </>
          )}
        </div>
      )}

      {/* Students */}
      {activeTab === 'students' && (
        <div className="admin-assignments-section">
          <h5 className="admin-section-title">Students</h5>
          {loading ? (
            <p className="prereq-note">Loading…</p>
          ) : students.length === 0 ? (
            <p className="prereq-note" style={{ fontStyle: 'italic' }}>No students enrolled yet.</p>
          ) : (
            <div className="dashboard-table-wrapper admin-table-responsive">
              <table className="dashboard-table admin-students-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Enrolled</th>
                    <th>Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const subCount = submissions.filter(sub =>
                      sub.student?.email === s.profile?.email
                    ).length;
                    return (
                      <tr key={s.student_id}>
                        <td data-label="Name"><strong>{s.profile?.name ?? '—'}</strong></td>
                        <td data-label="Email">{s.profile?.email ?? '—'}</td>
                        <td data-label="Enrolled">{s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : '—'}</td>
                        <td data-label="Submissions">{subCount} / {assignments.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      </div>
      {/* end .admin-content */}
      </div>
      {/* end .admin-layout */}

      {/* Hidden file input for reference notebook uploads */}
      <input ref={refInputRef} type="file" accept=".ipynb" style={{ display: 'none' }} onChange={handleRefFileSelected} />

      {editingFeedbackFor && (
        <div className="feedback-modal-overlay" onClick={() => setEditingFeedbackFor(null)}>
          <div className="feedback-edit-modal" onClick={e => e.stopPropagation()}>
            <div className="feedback-modal-header">
              <h5 className="feedback-modal-title">Edit feedback — {editingFeedbackFor.studentLabel}</h5>
              <span className="notebook-modal-actions">
                <button
                  type="button"
                  className="btn-primary btn-small"
                  onClick={() => {
                    handleFeedbackChange(editingFeedbackFor.subId, editingFeedbackFor.feedback);
                    setEditingFeedbackFor(null);
                  }}
                >
                  Save
                </button>
                <button type="button" className="btn-secondary btn-small" onClick={() => setEditingFeedbackFor(null)}>
                  Cancel
                </button>
              </span>
            </div>
            <div className="feedback-modal-body">
              <textarea
                className="admin-feedback-input admin-feedback-input-expanded"
                placeholder="Feedback"
                value={editingFeedbackFor.feedback}
                onChange={e => setEditingFeedbackFor(prev => prev ? { ...prev, feedback: e.target.value } : null)}
                rows={8}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete assignment?"
          message={`"${confirmDelete.title}" and all its submissions will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={confirmDeleteAssignment}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmGrade && (
        <ConfirmDialog
          title="Grade all submissions?"
          message={`Grade all submissions for "${confirmGrade.assignmentTitle}"? This may take a while. Already-graded submissions will be skipped unless you re-run with force.`}
          confirmLabel="Grade all"
          confirmVariant="primary"
          onConfirm={() => {
            handleGradeAll(confirmGrade.assignmentId);
            setConfirmGrade(null);
          }}
          onCancel={() => setConfirmGrade(null)}
        />
      )}

      {viewingNotebook && (
        <div className="notebook-modal-overlay" onClick={() => setViewingNotebook(null)}>
          <div className="notebook-modal" onClick={e => e.stopPropagation()}>
            <div className="notebook-modal-header">
              <h5 className="notebook-modal-title">{viewingNotebook.title}</h5>
              <span className="notebook-modal-actions">
                <button
                  type="button"
                  className={notebookViewMode === 'notebook' ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                  onClick={() => setNotebookViewMode('notebook')}
                >
                  Notebook
                </button>
                <button
                  type="button"
                  className={notebookViewMode === 'json' ? 'btn-primary btn-small' : 'btn-secondary btn-small'}
                  onClick={() => setNotebookViewMode('json')}
                >
                  JSON
                </button>
                <button type="button" className="btn-secondary btn-small" onClick={() => setViewingNotebook(null)}>
                  Close
                </button>
              </span>
            </div>
            <div className="notebook-modal-body">
              {notebookViewMode === 'json' ? (
                <pre className="notebook-json-view"><code>{JSON.stringify(viewingNotebook.notebook, null, 2)}</code></pre>
              ) : (
                <NotebookViewer notebook={viewingNotebook.notebook} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
