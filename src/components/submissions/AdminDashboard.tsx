'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Assignment, AdminSubmission, Course } from '@/types/submissions';
import ConfirmDialog from './ConfirmDialog';

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

type AdminTab = 'assignments' | 'submissions' | 'students';

export default function AdminDashboard({ user, course, onLogout, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('assignments');
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

  // Course name/term inline editing
  const [editingCourse, setEditingCourse] = useState(false);
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
    else setEditingCourse(false);
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

  async function openNotebook(pathOrUrl: string) {
    const sb = getSupabase();
    if (!sb) return;
    let storagePath = pathOrUrl;
    const marker = `/${BUCKET}/`;
    if (pathOrUrl.startsWith('https://')) {
      const idx = pathOrUrl.indexOf(marker);
      storagePath = idx !== -1 ? pathOrUrl.slice(idx + marker.length) : pathOrUrl;
    }
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) {
      alert('Could not open notebook: ' + (error?.message ?? 'unknown error'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
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
        sb.from('assignments').select('id, title, description, deadline').eq('course_id', course.id).order('id'),
        sb
          .from('submissions')
          .select(
            'id, assignment_id, notebook_url, score, feedback, created_at, student:profiles!submissions_student_id_fkey(email, name, role), assignment:assignments!fk_assignment(title, course_id)'
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
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button className="btn-secondary btn-small" onClick={onBack} type="button">← Courses</button>
          {editingCourse ? (
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
              <button type="button" className="btn-secondary btn-small" onClick={() => { setEditingCourse(false); setCourseName(course.name); setCourseTerm(course.term ?? ''); }}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h4 className="dashboard-title">{courseName}{courseTerm ? ` · ${courseTerm}` : ''}</h4>
              <button type="button" className="btn-secondary btn-small" onClick={() => setEditingCourse(true)}>
                Edit
              </button>
            </>
          )}
        </div>
        <button className="btn-secondary btn-small" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
      <p className="prereq-note dashboard-user-line">
        Logged in as <strong>{user.email}</strong>{' '}
        <span className="admin-badge">Admin</span>
      </p>

      {/* Signup toggle */}
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

      {message && (
        <p className={`admin-dashboard-message${isError ? ' error' : ''}`}>{message}</p>
      )}

      {/* Tab bar */}
      <div className="admin-tab-bar">
        {(['assignments', 'submissions', 'students'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            className={`admin-tab${activeTab === tab ? ' admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'assignments' && `Assignments (${assignments.length})`}
            {tab === 'submissions' && `Submissions (${submissions.length})`}
            {tab === 'students' && `Students (${students.length})`}
          </button>
        ))}
      </div>

      {/* Assignments management */}
      {activeTab === 'assignments' && <div className="admin-assignments-section">
        <h5 className="admin-section-title">Assignments</h5>
        <form className="admin-assignment-form" onSubmit={handleAddAssignment}>
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
          <button type="submit" className="btn-primary btn-small">Add</button>
        </form>

        {loading ? (
          <p className="prereq-note">Loading…</p>
        ) : (
          <ul className="admin-list">
            {assignments.length === 0 ? (
              <li className="admin-list-empty">No assignments defined.</li>
            ) : (
              assignments.map(a => {
                const draft = editingAssignment.get(a.id);
                const isEditing = !!draft;
                const isPast = a.deadline ? new Date(a.deadline) < new Date() : false;
                return (
                  <li key={a.id} className={`admin-assignment-item${isEditing ? ' admin-assignment-item--editing' : ''}`}>
                    {isEditing ? (
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
                          <button type="button" className="btn-primary btn-small" onClick={() => saveEdit(a.id)}>
                            Save
                          </button>
                          <button type="button" className="btn-secondary btn-small" onClick={() => cancelEdit(a.id)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span>
                          <strong>{a.title}</strong>
                          {a.description ? `: ${a.description}` : ''}
                          {a.deadline && (
                            <span className={`deadline-badge${isPast ? ' deadline-past' : ''}`}>
                              {isPast ? '⏰ Closed' : '⏰ Due'}{' '}
                              {new Date(a.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                          )}
                        </span>
                        <span className="admin-assignment-actions">
                          <button type="button" className="btn-secondary btn-small" onClick={() => startEdit(a)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger btn-small"
                            onClick={() => setConfirmDelete({ id: a.id, title: a.title })}
                          >
                            Delete
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>}

      {/* All submissions — grouped by assignment */}
      {activeTab === 'submissions' && <div className="admin-submissions-section">
        <h5 className="admin-section-title">Submissions by assignment</h5>
        {loading ? (
          <p className="prereq-note">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="prereq-note" style={{ fontStyle: 'italic' }}>No assignments yet.</p>
        ) : (
          <ul className="admin-accordion">
            {assignments.map(a => {
              const assignSubs = submissions.filter(s => s.assignment_id === a.id);
              const count = assignSubs.length;
              const isOpen = expandedAssignments.has(a.id);
              return (
                <li key={a.id} className="admin-accordion-item">
                  <button
                    type="button"
                    className="admin-accordion-header"
                    onClick={() => toggleAssignment(a.id)}
                  >
                    <span>
                      <strong>{a.title}</strong>
                      <span className="admin-accordion-count">{count} submission{count !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="admin-accordion-chevron">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="dashboard-table-wrapper">
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
                                <td>
                                  {sub.student?.name
                                    ? <><strong>{sub.student.name}</strong>{role}</>
                                    : (sub.student?.email ?? '—') + role
                                  }
                                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    {sub.student?.email ?? ''}
                                  </span>
                                </td>
                                <td>
                                  {sub.notebook_url ? (
                                    <button
                                      type="button"
                                      className="btn-secondary btn-small"
                                      onClick={() => openNotebook(sub.notebook_url!)}
                                    >
                                      Open ↗
                                    </button>
                                  ) : '—'}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step={0.5}
                                    className="admin-score-input"
                                    value={g.score}
                                    onChange={e => handleScoreChange(sub.id, e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="admin-feedback-input"
                                    placeholder="Feedback"
                                    value={g.feedback}
                                    onChange={e => handleFeedbackChange(sub.id, e.target.value)}
                                  />
                                </td>
                                <td>{sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>}

      {/* Students enrolled in this course */}
      {activeTab === 'students' && (
        <div className="admin-assignments-section">
          {loading ? (
            <p className="prereq-note">Loading…</p>
          ) : students.length === 0 ? (
            <p className="prereq-note" style={{ fontStyle: 'italic' }}>No students enrolled yet.</p>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
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
                        <td><strong>{s.profile?.name ?? '—'}</strong></td>
                        <td>{s.profile?.email ?? '—'}</td>
                        <td>{s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : '—'}</td>
                        <td>{subCount} / {assignments.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
    </div>
  );
}
