'use client';

import { useState, useEffect, useRef, FormEvent, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { formatCourseDateTime, parseCourseDate } from '@/lib/datetime';
import type { Assignment, AssignmentRubric, AdminSubmission, Course } from '@/types/submissions';
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
type RunProgress = {
  runId: string;
  status: 'running' | 'completed' | 'aborted' | 'error';
  total: number;
  completed: number;
  graded: number;
  errors: number;
  skipped: number;
  percent: number;
  elapsedSeconds: number;
  etaSeconds: number | null;
  message: string;
};

type PlagiarismCompareMode = 'students' | 'reference' | 'both';
type GradingMode = 'rubric' | 'legacy';

type RubricCriterionDraft = {
  id: string;
  title: string;
  weight: string;
  must_have: string;
};

type RubricEditDraft = {
  goal: string;
  scoring_notes: string;
  criteria: RubricCriterionDraft[];
};

type PlagiarismSubResult = {
  studentLabel: string;
  maxSimilarityPct: number;
  overlappingLabels: string[];
  studentFlagged: boolean;
  referenceSimilarityPct: number | null;
  referenceFlagged: boolean;
};

type PlagiarismCheckRun = {
  compareMode: PlagiarismCompareMode;
  thresholdPct: number;
  message: string;
  flagged: number;
  studentFlagged: number;
  referenceFlagged: number;
  total: number;
  hasReference: boolean;
  bySubmission: Map<number, PlagiarismSubResult>;
};

function formatGradingTokenUsage(t?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  cached_tokens?: number;
}): string {
  if (!t || (!t.prompt_tokens && !t.completion_tokens)) return '';
  const cached = t.cached_tokens
    ? ` (${t.cached_tokens.toLocaleString()} cached in)`
    : '';
  return ` · ${(t.prompt_tokens || 0).toLocaleString()} in / ${(t.completion_tokens || 0).toLocaleString()} out${cached}`;
}

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
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState<{ id: string; label: string } | null>(null);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [confirmGrade, setConfirmGrade] = useState<{ assignmentId: number; assignmentTitle: string } | null>(null);
  const [confirmGradeSelected, setConfirmGradeSelected] = useState<{
    assignmentId: number;
    assignmentTitle: string;
    selectedSubmissionIds: number[];
  } | null>(null);

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
    if (editingAssignment.has(a.id)) {
      cancelEdit(a.id);
      return;
    }
    const deadline = a.deadline
      ? new Date(parseCourseDate(a.deadline).getTime() - new Date().getTimezoneOffset() * 60000)
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
    patchAssignment(id, {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      deadline: draft.deadline ? new Date(draft.deadline).toISOString() : null,
    });
    cancelEdit(id);
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
      // Always load from Supabase (signed URL). The grading API is slow on cold start in production;
      // viewing does not need the API — same path as StudentDashboard.
      const json = await loadNotebookJsonFromStorage(storagePath);
      setViewingNotebook({ title, notebook: json });
      setNotebookViewMode('notebook');
    } catch (e) {
      alert('Could not load notebook: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingNotebook(false);
    }
  }

  async function downloadNotebook(pathOrUrl: string, submissionId: number, title: string) {
    const storagePath = getStoragePath(pathOrUrl);
    setDownloadingSubmissionId(submissionId);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Not configured');
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, 60);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No signed URL');
      const safeBase = title.trim().replace(/[^a-zA-Z0-9._-]+/g, '_') || `submission_${submissionId}`;
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = `${safeBase}.ipynb`;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert('Could not download notebook: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDownloadingSubmissionId(null);
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

  const SUBMISSION_SELECT =
    'id, assignment_id, notebook_url, score, feedback, created_at, verification_requested, verification_requested_at, verification_comment, student:profiles!submissions_student_id_fkey(email, name, role), assignment:assignments!fk_assignment(title, course_id)';

  function patchAssignment(id: number, patch: Partial<Assignment>) {
    setAssignments(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
  }

  function patchSubmission(id: number, patch: Partial<AdminSubmission>) {
    setSubmissions(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function refreshSubmissionsForAssignment(assignmentId: number) {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false });
    if (error) return;
    const fresh = (data ?? []) as unknown as AdminSubmission[];
    setSubmissions(prev => [...prev.filter(s => s.assignment_id !== assignmentId), ...fresh]);
  }

  async function loadData(options: { silent?: boolean } = {}) {
    const { silent = false } = options;
    const sb = getSupabase();
    if (!sb) return;
    if (!silent) {
      setLoading(true);
      showMsg('');
    }
    try {
      const [assignRes, subRes] = await Promise.all([
        sb.from('assignments').select('id, title, description, deadline, reference_notebook, rubric, rubric_generated_at').eq('course_id', course.id).order('id'),
        sb
          .from('submissions')
          .select(SUBMISSION_SELECT)
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
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string')
          ? (err as { message: string }).message
          : 'Failed to load data.';
      showMsg(msg.includes('rubric') ? `${msg} — run docs/supabase-rubric-migration.sql in Supabase.` : msg, true);
    } finally {
      if (!silent) setLoading(false);
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
    await loadData({ silent: true });
    showMsg('');
  }

  async function confirmDeleteAssignment() {
    if (!confirmDelete) return;
    const sb = getSupabase();
    if (!sb) return;
    const deletedId = confirmDelete.id;
    setConfirmDelete(null);
    showMsg('Deleting…');
    const { error } = await sb.from('assignments').delete().eq('id', deletedId);
    if (error) return showMsg('Failed to delete: ' + error.message, true);
    setAssignments(prev => prev.filter(a => a.id !== deletedId));
    setSubmissions(prev => prev.filter(s => s.assignment_id !== deletedId));
    showMsg('');
  }

  async function confirmRemoveStudentFromCourse() {
    if (!confirmRemoveStudent) return;
    const studentId = confirmRemoveStudent.id;
    const sb = getSupabase();
    if (!sb) return;
    setRemovingStudentId(studentId);
    const { error } = await sb
      .from('enrollments')
      .delete()
      .eq('course_id', course.id)
      .eq('student_id', studentId);
    setRemovingStudentId(null);
    if (error) {
      showMsg('Could not remove student: ' + error.message, true);
    } else {
      setStudents(prev => prev.filter(s => s.student_id !== studentId));
      showMsg('Student removed from this course.');
    }
    setConfirmRemoveStudent(null);
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
  const [gradingProgress, setGradingProgress] = useState<Map<number, RunProgress>>(new Map());
  const [plagiarismProgress, setPlagiarismProgress] = useState<Map<number, RunProgress>>(new Map());
  const [gradingAssignmentId, setGradingAssignmentId] = useState<number | null>(null);
  const [selectionModeByAssignment, setSelectionModeByAssignment] = useState<Set<number>>(new Set());
  const [selectedSubmissionIdsByAssignment, setSelectedSubmissionIdsByAssignment] = useState<Map<number, Set<number>>>(new Map());
  const PLAGIARISM_THRESHOLD_MIN = 20;
  const PLAGIARISM_THRESHOLD_MAX = 95;
  /** Min fingerprint similarity to flag overlap (API 0.2–0.95). Higher → fewer alerts. */
  const [plagiarismThresholdPct, setPlagiarismThresholdPct] = useState(60);

  function clampPlagiarismThresholdPct(value: number): number {
    return Math.min(PLAGIARISM_THRESHOLD_MAX, Math.max(PLAGIARISM_THRESHOLD_MIN, Math.round(value)));
  }
  const [plagiarismCompareMode, setPlagiarismCompareMode] = useState<PlagiarismCompareMode>('students');
  const [gradingMode, setGradingMode] = useState<GradingMode>('rubric');
  const [uploadingRefId, setUploadingRefId] = useState<number | null>(null);
  const [generatingRubricId, setGeneratingRubricId] = useState<number | null>(null);
  const [freshRubricId, setFreshRubricId] = useState<number | null>(null);
  const [rubricPreviewId, setRubricPreviewId] = useState<number | null>(null);
  const [editingRubricId, setEditingRubricId] = useState<number | null>(null);
  const [rubricDraft, setRubricDraft] = useState<Map<number, RubricEditDraft>>(new Map());
  const [savingRubricId, setSavingRubricId] = useState<number | null>(null);
  const [plagiarismCheckAssignmentId, setPlagiarismCheckAssignmentId] = useState<number | null>(null);
  const [plagiarismCheckingId, setPlagiarismCheckingId] = useState<number | null>(null);
  const [plagiarismCheckStatus, setPlagiarismCheckStatus] = useState<Map<number, { msg: string; isError: boolean }>>(new Map());
  const [plagiarismResultsByAssignment, setPlagiarismResultsByAssignment] = useState<Map<number, PlagiarismCheckRun>>(new Map());
  const [actionsMenuId, setActionsMenuId] = useState<number | null>(null);
  const [viewingNotebook, setViewingNotebook] = useState<{ title: string; notebook: Record<string, unknown> } | null>(null);
  const [notebookViewMode, setNotebookViewMode] = useState<'notebook' | 'json'>('notebook');
  const [loadingNotebook, setLoadingNotebook] = useState(false);
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<number | null>(null);
  const [editingFeedbackFor, setEditingFeedbackFor] = useState<{ subId: number; feedback: string; studentLabel: string } | null>(null);
  const progressPollTimersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const plagiarismPollTimersRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  const API_URL    = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
  const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET ?? '';

  function setGradeMsg(id: number, msg: string, isErr = false) {
    setGradingStatus(p => new Map(p).set(id, msg));
    setGradingError(p  => new Map(p).set(id, isErr));
  }

  function shortenAssignmentTitle(title: string, maxLen = 14): string {
    const t = title.trim();
    return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}…`;
  }

  function buildGradebookRows() {
    const latestByStudentAssignment = new Map<string, AdminSubmission>();
    for (const sub of submissions) {
      const email = sub.student?.email;
      if (!email) continue;
      const key = `${email}:${sub.assignment_id}`;
      const prev = latestByStudentAssignment.get(key);
      if (!prev || new Date(sub.created_at) > new Date(prev.created_at)) {
        latestByStudentAssignment.set(key, sub);
      }
    }

    return students
      .slice()
      .sort((a, b) => {
        const aLabel = a.profile?.name || a.profile?.email || '';
        const bLabel = b.profile?.name || b.profile?.email || '';
        return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
      })
      .map(student => {
        const email = student.profile?.email ?? '';
        return {
          student,
          label: student.profile?.name || student.profile?.email || '—',
          scores: assignments.map(assignment => {
            const sub = email ? latestByStudentAssignment.get(`${email}:${assignment.id}`) : undefined;
            return sub?.score ?? null;
          }),
        };
      });
  }

  function setPlagiarismMsg(assignmentId: number, msg: string, isErr = false) {
    setPlagiarismCheckStatus(prev => new Map(prev).set(assignmentId, { msg, isError: isErr }));
  }

  function overlapModeLabel(mode: PlagiarismCompareMode): string {
    if (mode === 'reference') return 'reference solution';
    if (mode === 'both') return 'students and reference';
    return 'student notebooks';
  }

  function overlapSelectionRequirement(mode: PlagiarismCompareMode, selectedCount: number, hasReference: boolean): string | null {
    if (mode === 'students' && selectedCount < 2) return 'Select at least 2 submissions to compare students.';
    if (mode !== 'students' && !hasReference) return 'Upload a reference notebook first.';
    if (mode !== 'students' && selectedCount < 1) return 'Select at least 1 submission.';
    return null;
  }

  function assignmentSimilarityBlocked(
    mode: PlagiarismCompareMode,
    submissionCount: number,
    hasReference: boolean,
  ): string | null {
    if (submissionCount < 1) return 'No submissions with notebooks to compare.';
    if (mode === 'students' && submissionCount < 2) return 'Need at least 2 submissions to compare students.';
    if (mode !== 'students' && !hasReference) return 'Upload a reference notebook first.';
    return null;
  }

  function renderSimilaritySettingsControls(opts: { idSuffix?: string; showHint?: boolean }) {
    const suffix = opts.idSuffix ?? '';
    const thresholdId = `admin-plagiarism-threshold${suffix}`;
    const hintId = `admin-plagiarism-threshold-hint${suffix}`;
    return (
      <div className="admin-similarity-settings-controls">
        <label className="admin-similarity-settings-field" htmlFor={thresholdId}>
          <span className="admin-similarity-settings-field-label">Flag at ≥</span>
          <span className="admin-plagiarism-threshold-field">
            <input
              id={thresholdId}
              type="number"
              min={PLAGIARISM_THRESHOLD_MIN}
              max={PLAGIARISM_THRESHOLD_MAX}
              step={1}
              value={plagiarismThresholdPct}
              onChange={e => {
                const next = Number(e.target.value);
                if (!Number.isNaN(next)) setPlagiarismThresholdPct(next);
              }}
              onBlur={() => setPlagiarismThresholdPct(prev => clampPlagiarismThresholdPct(prev))}
              className="admin-plagiarism-threshold-input admin-similarity-settings-input"
              aria-describedby={opts.showHint ? hintId : undefined}
            />
            <span className="admin-plagiarism-threshold-suffix">%</span>
          </span>
        </label>
        <label className="admin-similarity-settings-field">
          <span className="admin-similarity-settings-field-label">Compare</span>
          <select
            value={plagiarismCompareMode}
            onChange={e => setPlagiarismCompareMode(e.target.value as PlagiarismCompareMode)}
            className="admin-plagiarism-threshold-select admin-similarity-settings-select"
            aria-label="Similarity compare mode"
          >
            <option value="students">Students with each other</option>
            <option value="reference">Students vs reference solution</option>
            <option value="both">Both checks</option>
          </select>
        </label>
        {opts.showHint && (
          <span id={hintId} className="admin-similarity-settings-hint">
            {PLAGIARISM_THRESHOLD_MIN}%–{PLAGIARISM_THRESHOLD_MAX}% · lower = more alerts · used for checks and grading
          </span>
        )}
      </div>
    );
  }

  function buildOverlapDetailLines(run: PlagiarismCheckRun): string[] {
    const lines: string[] = [];
    const seenPairs = new Set<string>();

    if (run.compareMode === 'students' || run.compareMode === 'both') {
      for (const result of run.bySubmission.values()) {
        if (!result.studentFlagged) continue;
        for (const peer of result.overlappingLabels) {
          const key = [result.studentLabel, peer].sort().join('||');
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          lines.push(`${result.studentLabel} ↔ ${peer} (${result.maxSimilarityPct}%+)`);
        }
      }
    }

    if (run.compareMode === 'reference' || run.compareMode === 'both') {
      for (const result of run.bySubmission.values()) {
        if (!result.referenceFlagged || result.referenceSimilarityPct == null) continue;
        lines.push(`${result.studentLabel} ↔ reference solution (${result.referenceSimilarityPct}%+)`);
      }
    }

    return lines;
  }

  function renderOverlapCell(overlap: PlagiarismSubResult, compareMode: PlagiarismCompareMode) {
    if (compareMode === 'reference') {
      if (overlap.referenceSimilarityPct == null) return <span className="admin-overlap-empty">—</span>;
      return overlap.referenceFlagged ? (
        <div className="admin-overlap-cell">
          <span className="admin-overlap-badge admin-overlap-badge--flagged">
            {overlap.referenceSimilarityPct}% vs reference
          </span>
          <span className="admin-overlap-with">May match public solution</span>
        </div>
      ) : (
        <span className="admin-overlap-badge">Below threshold</span>
      );
    }

    if (compareMode === 'both') {
      const hasStudent = overlap.studentFlagged;
      const hasReference = overlap.referenceFlagged;
      if (!hasStudent && !hasReference) {
        return <span className="admin-overlap-badge">Below threshold</span>;
      }
      return (
        <div className="admin-overlap-cell">
          {hasStudent && (
            <>
              <span className="admin-overlap-badge admin-overlap-badge--flagged">
                {overlap.maxSimilarityPct}% vs peers
              </span>
              <span className="admin-overlap-with">with {overlap.overlappingLabels.join(', ')}</span>
            </>
          )}
          {hasReference && overlap.referenceSimilarityPct != null && (
            <>
              <span className="admin-overlap-badge admin-overlap-badge--flagged">
                {overlap.referenceSimilarityPct}% vs reference
              </span>
              <span className="admin-overlap-with">May match public solution</span>
            </>
          )}
        </div>
      );
    }

    if (overlap.studentFlagged) {
      return (
        <div className="admin-overlap-cell">
          <span className="admin-overlap-badge admin-overlap-badge--flagged">
            {overlap.maxSimilarityPct}% match
          </span>
          <span className="admin-overlap-with">with {overlap.overlappingLabels.join(', ')}</span>
        </div>
      );
    }
    return <span className="admin-overlap-badge">Below threshold</span>;
  }

  async function handlePlagiarismCheck(
    assignmentId: number,
    submissionIds?: number[],
    compareMode: PlagiarismCompareMode = plagiarismCompareMode,
  ) {
    if (!API_URL) {
      setPlagiarismMsg(assignmentId, 'Grading service not configured.', true);
      return;
    }
    const assignment = assignments.find(a => a.id === assignmentId);
    if (compareMode !== 'students' && !assignment?.reference_notebook) {
      setPlagiarismMsg(assignmentId, 'Upload a reference notebook first to compare against the solution.', true);
      return;
    }
    const runId = createRunId();
    setPlagiarismCheckingId(assignmentId);
    startPlagiarismProgressPolling(assignmentId, runId);
    try {
      const params = new URLSearchParams();
      params.set('plagiarism_threshold', String(clampPlagiarismThresholdPct(plagiarismThresholdPct) / 100));
      params.set('compare_with', compareMode);
      params.set('run_id', runId);
      const endpoint = submissionIds?.length
        ? `${API_URL}/plagiarism/${assignmentId}/selected?${params}`
        : `${API_URL}/plagiarism/${assignmentId}?${params}`;
      const fetchInit: RequestInit = {
        method: 'POST',
        headers: API_SECRET ? { 'x-api-key': API_SECRET } : {},
      };
      if (submissionIds?.length) {
        fetchInit.headers = {
          'Content-Type': 'application/json',
          ...(API_SECRET ? { 'x-api-key': API_SECRET } : {}),
        };
        fetchInit.body = JSON.stringify({ submission_ids: submissionIds });
      }
      const res = await fetch(endpoint, fetchInit);
      const data: {
        detail?: string;
        message?: string;
        compare_with?: PlagiarismCompareMode;
        threshold?: number;
        flagged?: number;
        student_flagged?: number;
        reference_flagged?: number;
        has_reference?: boolean;
        total?: number;
        load_errors?: number;
        submissions?: Array<{
          id: number;
          student_label?: string;
          max_similarity: number;
          overlapping_labels: string[];
          student_flagged?: boolean;
          reference_similarity?: number | null;
          reference_flagged?: boolean;
          flagged: boolean;
        }>;
      } = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Unknown error');

      const bySubmission = new Map<number, PlagiarismSubResult>();
      for (const row of data.submissions ?? []) {
        bySubmission.set(row.id, {
          studentLabel: row.student_label ?? `Submission ${row.id}`,
          maxSimilarityPct: Math.round((row.max_similarity ?? 0) * 100),
          overlappingLabels: row.overlapping_labels ?? [],
          studentFlagged: !!row.student_flagged,
          referenceSimilarityPct: row.reference_similarity != null
            ? Math.round(row.reference_similarity * 100)
            : null,
          referenceFlagged: !!row.reference_flagged,
        });
      }
      const checkRun: PlagiarismCheckRun = {
        compareMode: data.compare_with ?? compareMode,
        thresholdPct: Math.round((data.threshold ?? plagiarismThresholdPct / 100) * 100),
        message: data.message ?? 'Overlap check complete.',
        flagged: data.flagged ?? 0,
        studentFlagged: data.student_flagged ?? 0,
        referenceFlagged: data.reference_flagged ?? 0,
        total: data.total ?? 0,
        hasReference: !!data.has_reference,
        bySubmission,
      };
      setPlagiarismResultsByAssignment(prev => {
        const next = new Map(prev);
        next.set(assignmentId, checkRun);
        return next;
      });
      setExpandedAssignments(prev => new Set(prev).add(assignmentId));
      const loadErrPart = data.load_errors ? ` · ${data.load_errors} notebook(s) could not be read` : '';
      const detailLines = buildOverlapDetailLines(checkRun);
      const detailPart = detailLines.length > 0 ? ` — ${detailLines.join('; ')}` : '';
      setPlagiarismMsg(
        assignmentId,
        `${data.message ?? 'Done.'}${detailPart}${loadErrPart} (no AI used)`,
      );
      setPlagiarismProgress(prev => {
        const next = new Map(prev);
        const current = next.get(assignmentId);
        if (current) {
          next.set(assignmentId, { ...current, status: 'completed', percent: 100, message: data.message ?? 'Similarity check complete.' });
        }
        return next;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg === 'Failed to fetch' ? ' — Service unreachable.' : '';
      setPlagiarismMsg(assignmentId, `Overlap check failed: ${msg}${hint}`, true);
      setPlagiarismProgress(prev => {
        const next = new Map(prev);
        const current = next.get(assignmentId);
        if (current) {
          next.set(assignmentId, { ...current, status: 'error', message: `Check failed: ${msg}` });
        }
        return next;
      });
    } finally {
      stopPlagiarismProgressPolling(assignmentId);
      setPlagiarismCheckingId(null);
    }
  }

  function createRunId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `grade-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function stopProgressPolling(assignmentId: number) {
    const timer = progressPollTimersRef.current.get(assignmentId);
    if (timer) {
      clearInterval(timer);
      progressPollTimersRef.current.delete(assignmentId);
    }
  }

  function stopPlagiarismProgressPolling(assignmentId: number) {
    const timer = plagiarismPollTimersRef.current.get(assignmentId);
    if (timer) {
      clearInterval(timer);
      plagiarismPollTimersRef.current.delete(assignmentId);
    }
  }

  function parseRunProgressPayload(data: {
    run_id: string;
    status: 'running' | 'completed' | 'aborted' | 'error';
    total: number;
    completed: number;
    graded: number;
    errors: number;
    skipped: number;
    percent: number;
    elapsed_seconds: number;
    eta_seconds: number | null;
    message: string;
  }): RunProgress {
    return {
      runId: data.run_id,
      status: data.status,
      total: data.total,
      completed: data.completed,
      graded: data.graded,
      errors: data.errors,
      skipped: data.skipped,
      percent: data.percent,
      elapsedSeconds: data.elapsed_seconds,
      etaSeconds: data.eta_seconds,
      message: data.message,
    };
  }

  function startRunProgressPolling(
    assignmentId: number,
    runId: string,
    setProgress: Dispatch<SetStateAction<Map<number, RunProgress>>>,
    timersRef: MutableRefObject<Map<number, ReturnType<typeof setInterval>>>,
    stopPolling: (id: number) => void,
  ) {
    stopPolling(assignmentId);
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/grade/progress/${encodeURIComponent(runId)}`, {
          headers: API_SECRET ? { 'x-api-key': API_SECRET } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        setProgress(prev => {
          const next = new Map(prev);
          next.set(assignmentId, parseRunProgressPayload(data));
          return next;
        });
        if (data.status !== 'running') stopPolling(assignmentId);
      } catch {
        // Keep polling; transient network errors should not kill progress UI.
      }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 1500);
    timersRef.current.set(assignmentId, timer);
  }

  function startProgressPolling(assignmentId: number, runId: string) {
    startRunProgressPolling(assignmentId, runId, setGradingProgress, progressPollTimersRef, stopProgressPolling);
  }

  function startPlagiarismProgressPolling(assignmentId: number, runId: string) {
    startRunProgressPolling(assignmentId, runId, setPlagiarismProgress, plagiarismPollTimersRef, stopPlagiarismProgressPolling);
  }

  function renderRunProgressBar(
    progress: RunProgress | undefined,
    defaultLabel: string,
    variant: 'grading' | 'similarity' = 'grading',
  ) {
    if (!progress) return null;
    return (
      <div
        className={`admin-grading-progress${variant === 'similarity' ? ' admin-grading-progress--similarity' : ''}`}
        role="status"
        aria-live="polite"
      >
        <div className="admin-grading-progress-top">
          <span className="admin-grading-progress-label">
            {progress.message || defaultLabel}
          </span>
          <span className="admin-grading-progress-stats">
            {progress.completed}/{progress.total}
            {progress.etaSeconds != null && progress.status === 'running'
              ? ` · ETA ~${Math.max(1, Math.round(progress.etaSeconds))}s`
              : ''}
          </span>
        </div>
        <div className="admin-grading-progress-track">
          <div
            className="admin-grading-progress-fill"
            style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
          />
        </div>
      </div>
    );
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
    setUploadingRefId(assignId);
    setGradeMsg(assignId, 'Uploading reference…');
    const path = `reference/${assignId}_reference.ipynb`;
    try {
      const { error: upErr } = await sb.storage.from('student-notebooks').upload(path, file, { upsert: true, contentType: 'application/json' });
      if (upErr) { setGradeMsg(assignId, 'Upload failed: ' + upErr.message, true); return; }
      const { error: dbErr } = await sb.from('assignments').update({
        reference_notebook: path,
        rubric: null,
        rubric_generated_at: null,
      }).eq('id', assignId);
      if (dbErr) { setGradeMsg(assignId, 'DB update failed: ' + dbErr.message, true); return; }
      patchAssignment(assignId, {
        reference_notebook: path,
        rubric: null,
        rubric_generated_at: null,
      });
      setRubricPreviewId(prev => (prev === assignId ? null : prev));
      setEditingRubricId(prev => (prev === assignId ? null : prev));
      setRubricDraft(prev => { const m = new Map(prev); m.delete(assignId); return m; });
      setFreshRubricId(null);
      setExpandedAssignments(prev => new Set(prev).add(assignId));
      setGradeMsg(assignId, 'Reference uploaded ✓ — generate a new rubric before grading');
    } finally {
      setUploadingRefId(null);
    }
  }

  async function handleGenerateRubric(assignmentId: number) {
    if (!API_URL) { setGradeMsg(assignmentId, 'Grading service not configured.', true); return; }
    setGradeMsg(assignmentId, 'Generating rubric…');
    setGeneratingRubricId(assignmentId);
    try {
      const res = await fetch(`${API_URL}/rubric/${assignmentId}/generate`, {
        method: 'POST',
        headers: API_SECRET ? { 'x-api-key': API_SECRET } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Unknown error');
      patchAssignment(assignmentId, {
        rubric: data.rubric,
        rubric_generated_at: data.rubric_generated_at,
      });
      setRubricPreviewId(assignmentId);
      setEditingRubricId(null);
      setRubricDraft(prev => { const m = new Map(prev); m.delete(assignmentId); return m; });
      setFreshRubricId(assignmentId);
      setExpandedAssignments(prev => new Set(prev).add(assignmentId));
      const t = data.tokens_used;
      const usageStr = t?.total_tokens ? ` · ${t.total_tokens.toLocaleString()} tokens` : '';
      setGradeMsg(assignmentId, `Rubric generated ✓${usageStr}`);
      window.setTimeout(() => {
        setFreshRubricId(prev => (prev === assignmentId ? null : prev));
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGradeMsg(assignmentId, `Rubric generation failed: ${msg}`, true);
    } finally {
      setGeneratingRubricId(null);
    }
  }

  function slugifyCriterionId(title: string, fallback: string): string {
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return slug || fallback;
  }

  function rubricToDraft(rubric: AssignmentRubric): RubricEditDraft {
    return {
      goal: rubric.goal,
      scoring_notes: rubric.scoring_notes ?? '',
      criteria: rubric.criteria.map(c => ({
        id: c.id,
        title: c.title,
        weight: c.weight != null ? String(c.weight) : '',
        must_have: (c.must_have ?? []).join('\n'),
      })),
    };
  }

  function startEditRubric(assignmentId: number, rubric: AssignmentRubric) {
    setRubricDraft(prev => new Map(prev).set(assignmentId, rubricToDraft(rubric)));
    setEditingRubricId(assignmentId);
    setRubricPreviewId(assignmentId);
    setExpandedAssignments(prev => new Set(prev).add(assignmentId));
  }

  function cancelEditRubric(assignmentId: number) {
    setEditingRubricId(prev => (prev === assignmentId ? null : prev));
    setRubricDraft(prev => { const m = new Map(prev); m.delete(assignmentId); return m; });
  }

  function updateRubricDraftField(
    assignmentId: number,
    field: 'goal' | 'scoring_notes',
    value: string,
  ) {
    setRubricDraft(prev => {
      const m = new Map(prev);
      const draft = m.get(assignmentId);
      if (!draft) return prev;
      m.set(assignmentId, { ...draft, [field]: value });
      return m;
    });
  }

  function updateRubricCriterionDraft(
    assignmentId: number,
    index: number,
    field: keyof RubricCriterionDraft,
    value: string,
  ) {
    setRubricDraft(prev => {
      const m = new Map(prev);
      const draft = m.get(assignmentId);
      if (!draft) return prev;
      const criteria = draft.criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c));
      m.set(assignmentId, { ...draft, criteria });
      return m;
    });
  }

  function addRubricCriterionDraft(assignmentId: number) {
    setRubricDraft(prev => {
      const m = new Map(prev);
      const draft = m.get(assignmentId);
      if (!draft) return prev;
      const n = draft.criteria.length + 1;
      m.set(assignmentId, {
        ...draft,
        criteria: [...draft.criteria, { id: `criterion_${n}`, title: '', weight: '', must_have: '' }],
      });
      return m;
    });
  }

  function removeRubricCriterionDraft(assignmentId: number, index: number) {
    setRubricDraft(prev => {
      const m = new Map(prev);
      const draft = m.get(assignmentId);
      if (!draft || draft.criteria.length <= 1) return prev;
      m.set(assignmentId, {
        ...draft,
        criteria: draft.criteria.filter((_, i) => i !== index),
      });
      return m;
    });
  }

  function draftToRubric(draft: RubricEditDraft): AssignmentRubric | null {
    const goal = draft.goal.trim();
    if (!goal) return null;
    const criteria = draft.criteria
      .map((c, index) => {
        const title = c.title.trim();
        if (!title) return null;
        const weight = c.weight.trim() ? parseInt(c.weight, 10) : undefined;
        const must_have = c.must_have
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean);
        return {
          id: c.id.trim() || slugifyCriterionId(title, `criterion_${index + 1}`),
          title,
          weight: weight != null && !isNaN(weight) ? weight : undefined,
          must_have: must_have.length > 0 ? must_have : undefined,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c != null);
    if (criteria.length === 0) return null;
    const scoring_notes = draft.scoring_notes.trim();
    return {
      goal,
      criteria,
      scoring_notes: scoring_notes || undefined,
    };
  }

  async function saveRubricEdit(assignmentId: number) {
    const draft = rubricDraft.get(assignmentId);
    if (!draft) return;
    const rubric = draftToRubric(draft);
    if (!rubric) {
      setGradeMsg(assignmentId, 'Rubric needs a goal and at least one criterion with a title.', true);
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setSavingRubricId(assignmentId);
    setGradeMsg(assignmentId, 'Saving rubric…');
    const { error } = await sb.from('assignments').update({ rubric }).eq('id', assignmentId);
    setSavingRubricId(null);
    if (error) {
      setGradeMsg(assignmentId, 'Failed to save rubric: ' + error.message, true);
      return;
    }
    patchAssignment(assignmentId, { rubric });
    cancelEditRubric(assignmentId);
    setGradeMsg(assignmentId, 'Rubric saved ✓');
  }

  function renderRubricEditor(assignmentId: number) {
    const draft = rubricDraft.get(assignmentId);
    if (!draft) return null;
    const saving = savingRubricId === assignmentId;
    return (
      <div className="admin-rubric-edit-form">
        <label className="admin-rubric-edit-label">
          Goal
          <textarea
            className="admin-multiline-field"
            rows={2}
            value={draft.goal}
            onChange={e => updateRubricDraftField(assignmentId, 'goal', e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="admin-rubric-edit-label">
          Scoring notes
          <textarea
            className="admin-multiline-field"
            rows={2}
            value={draft.scoring_notes}
            onChange={e => updateRubricDraftField(assignmentId, 'scoring_notes', e.target.value)}
            disabled={saving}
            placeholder="Optional guidance for graders"
          />
        </label>
        <div className="admin-rubric-edit-criteria">
          <span className="admin-rubric-edit-label">Criteria</span>
          {draft.criteria.map((criterion, index) => (
            <div key={`${criterion.id}-${index}`} className="admin-rubric-criterion-card">
              <div className="admin-rubric-criterion-card-head">
                <span className="admin-rubric-criterion-card-index">#{index + 1}</span>
                <button
                  type="button"
                  className="btn-secondary btn-small admin-rubric-criterion-remove"
                  onClick={() => removeRubricCriterionDraft(assignmentId, index)}
                  disabled={saving || draft.criteria.length <= 1}
                  title="Remove criterion"
                >
                  Remove
                </button>
              </div>
              <input
                type="text"
                placeholder="Criterion title"
                value={criterion.title}
                onChange={e => updateRubricCriterionDraft(assignmentId, index, 'title', e.target.value)}
                disabled={saving}
              />
              <input
                type="number"
                min={1}
                max={5}
                placeholder="Weight (1–5)"
                value={criterion.weight}
                onChange={e => updateRubricCriterionDraft(assignmentId, index, 'weight', e.target.value)}
                disabled={saving}
                className="admin-rubric-weight-input"
              />
              <textarea
                className="admin-multiline-field"
                rows={3}
                placeholder="Must-have requirements (one per line)"
                value={criterion.must_have}
                onChange={e => updateRubricCriterionDraft(assignmentId, index, 'must_have', e.target.value)}
                disabled={saving}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => addRubricCriterionDraft(assignmentId)}
            disabled={saving}
          >
            Add criterion
          </button>
        </div>
      </div>
    );
  }

  function renderRubricPreview(rubric: AssignmentRubric) {
    return (
      <div className="admin-rubric-preview">
        <p className="admin-rubric-goal"><strong>Goal:</strong> {rubric.goal}</p>
        {rubric.scoring_notes && (
          <p className="admin-rubric-notes">{rubric.scoring_notes}</p>
        )}
        <ol className="admin-rubric-criteria">
          {rubric.criteria.map(c => (
            <li key={c.id}>
              <strong>{c.title}</strong>
              {c.weight != null && <span className="admin-rubric-weight"> (weight {c.weight})</span>}
              {c.must_have && c.must_have.length > 0 && (
                <ul>
                  {c.must_have.map(item => <li key={item}>{item}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  async function handleGradeAll(assignmentId: number, force = false) {
    if (!API_URL) { setGradeMsg(assignmentId, 'Grading service not configured.', true); return; }
    const assignment = assignments.find(a => a.id === assignmentId);
    if (gradingMode === 'rubric' && !assignment?.rubric) {
      setGradeMsg(assignmentId, 'Generate a rubric before rubric-mode grading.', true);
      return;
    }
    setGradeMsg(assignmentId, 'Grading in progress…');
    setGradingAssignmentId(assignmentId);
    const runId = createRunId();
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    params.set('plagiarism_threshold', String(clampPlagiarismThresholdPct(plagiarismThresholdPct) / 100));
    params.set('grading_mode', gradingMode);
    params.set('run_id', runId);
    startProgressPolling(assignmentId, runId);
    try {
      const res = await fetch(`${API_URL}/grade/${assignmentId}?${params}`, {
        method: 'POST',
        headers: API_SECRET ? { 'x-api-key': API_SECRET } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Unknown error');
      const usageStr = formatGradingTokenUsage(data.tokens_used);
      const suffix = data.aborted ? ' (stopped)' : '';
      setGradeMsg(
        assignmentId,
        data.aborted
          ? `Stopped — ${data.graded} graded, ${data.errors} errors${usageStr}${suffix}`
          : `Done — ${data.graded} graded, ${data.errors} errors${usageStr}`,
      );
      setGradingProgress(prev => {
        const next = new Map(prev);
        const current = next.get(assignmentId);
        if (current) {
          next.set(assignmentId, { ...current, status: data.aborted ? 'aborted' : 'completed', percent: 100 });
        }
        return next;
      });
      await refreshSubmissionsForAssignment(assignmentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg === 'Failed to fetch'
        ? ' — Service unreachable. Check your configuration.'
        : '';
      setGradeMsg(assignmentId, `Grading failed: ${msg}${hint}`, true);
    } finally {
      stopProgressPolling(assignmentId);
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

  function toggleSelectionMode(assignmentId: number) {
    setSelectionModeByAssignment(prev => {
      const next = new Set(prev);
      if (next.has(assignmentId)) {
        next.delete(assignmentId);
        setSelectedSubmissionIdsByAssignment(map => {
          const m = new Map(map);
          m.delete(assignmentId);
          return m;
        });
      } else {
        next.add(assignmentId);
      }
      return next;
    });
  }

  function setSelectedSubmissionsForAssignment(assignmentId: number, ids: number[]) {
    setSelectedSubmissionIdsByAssignment(prev => {
      const next = new Map(prev);
      next.set(assignmentId, new Set(ids));
      return next;
    });
  }

  function toggleSubmissionSelection(assignmentId: number, submissionId: number) {
    setSelectedSubmissionIdsByAssignment(prev => {
      const next = new Map(prev);
      const current = new Set(next.get(assignmentId) ?? []);
      if (current.has(submissionId)) current.delete(submissionId);
      else current.add(submissionId);
      next.set(assignmentId, current);
      return next;
    });
  }

  async function handleGradeSelected(assignmentId: number, submissionIds: number[], force = false) {
    if (!API_URL) { setGradeMsg(assignmentId, 'Grading service not configured.', true); return; }
    if (submissionIds.length === 0) { setGradeMsg(assignmentId, 'No submissions selected.', true); return; }
    const assignment = assignments.find(a => a.id === assignmentId);
    if (gradingMode === 'rubric' && !assignment?.rubric) {
      setGradeMsg(assignmentId, 'Generate a rubric before rubric-mode grading.', true);
      return;
    }
    setGradeMsg(assignmentId, `Grading ${submissionIds.length} selected submission(s)…`);
    setGradingAssignmentId(assignmentId);
    const runId = createRunId();
    try {
      const params = new URLSearchParams();
      if (force) params.set('force', 'true');
      params.set('plagiarism_threshold', String(clampPlagiarismThresholdPct(plagiarismThresholdPct) / 100));
      params.set('grading_mode', gradingMode);
      params.set('run_id', runId);
      startProgressPolling(assignmentId, runId);
      const res = await fetch(`${API_URL}/grade/${assignmentId}/selected?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_SECRET ? { 'x-api-key': API_SECRET } : {}),
        },
        body: JSON.stringify({ submission_ids: submissionIds }),
      });
      const text = await res.text();
      let data: { graded?: number; skipped?: number; errors?: number; error_details?: Array<{ id: number; error: string }>; tokens_used?: { prompt_tokens?: number; completion_tokens?: number; cached_tokens?: number; total_tokens?: number }; } = {};
      try { data = JSON.parse(text); } catch { /* keep raw text fallback */ }
      if (!res.ok) throw new Error((data as { detail?: string })?.detail || text || `HTTP ${res.status}`);
      const tokenPart = formatGradingTokenUsage(data.tokens_used);
      setGradeMsg(
        assignmentId,
        `Done: ${data.graded ?? 0} graded, ${data.skipped ?? 0} skipped, ${data.errors ?? 0} errors${tokenPart}`
      );
      setGradingProgress(prev => {
        const next = new Map(prev);
        const current = next.get(assignmentId);
        if (current) {
          next.set(assignmentId, { ...current, status: 'completed', percent: 100 });
        }
        return next;
      });
      if (data.error_details?.length) {
        console.warn('Grading errors:', data.error_details);
      }
      setSelectionModeByAssignment(prev => { const s = new Set(prev); s.delete(assignmentId); return s; });
      setSelectedSubmissionIdsByAssignment(prev => { const m = new Map(prev); m.delete(assignmentId); return m; });
      await refreshSubmissionsForAssignment(assignmentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGradeMsg(assignmentId, `Selected grading failed: ${msg}`, true);
    } finally {
      stopProgressPolling(assignmentId);
      setGradingAssignmentId(null);
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

  useEffect(() => {
    if (assignments.length === 0) return;
    setPlagiarismCheckAssignmentId(prev => {
      if (prev != null && assignments.some(a => a.id === prev)) return prev;
      return assignments[0].id;
    });
  }, [assignments]);

  useEffect(() => () => {
    for (const timer of progressPollTimersRef.current.values()) clearInterval(timer);
    progressPollTimersRef.current.clear();
    for (const timer of plagiarismPollTimersRef.current.values()) clearInterval(timer);
    plagiarismPollTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (actionsMenuId == null) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element) || !target.closest('.admin-assignment-menu')) {
        setActionsMenuId(null);
      }
    }
    const timeoutId = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [actionsMenuId]);

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

          <div className="detail-card submissions-api-card submissions-api-card--tight">
            <UsageStats />
          </div>
        </>
      )}

      {/* Assignments: add button + form (when open) + accordion with submissions */}
      {activeTab === 'assignments' && (
        <div className="admin-assignments-section">
          <div className="admin-section-head">
            <h5 className="admin-section-title">Assignments</h5>
            <div className="admin-section-head-actions">
              <label className="admin-grading-mode-control">
                <span className="admin-grading-mode-label">AI grading</span>
                <select
                  value={gradingMode}
                  onChange={e => setGradingMode(e.target.value as GradingMode)}
                  className="admin-plagiarism-threshold-select admin-grading-mode-select"
                  aria-label="AI grading mode"
                >
                  <option value="rubric">Rubric (evidence + grade)</option>
                  <option value="legacy">Legacy (single pass)</option>
                </select>
              </label>
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
                <textarea
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  rows={3}
                  className="admin-multiline-field"
                  aria-label="Assignment description"
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

          {!loading && assignments.length > 0 && (
            <section className="admin-similarity-toolbar" aria-label="Similarity settings and quick check">
              <div className="admin-similarity-toolbar-main">
                <span className="admin-similarity-toolbar-title">Similarity</span>
                {renderSimilaritySettingsControls({ showHint: true })}
                <div className="admin-similarity-toolbar-run">
                  <label className="admin-similarity-settings-field">
                    <span className="admin-similarity-settings-field-label">Quick check</span>
                    <select
                      value={plagiarismCheckAssignmentId ?? ''}
                      onChange={e => setPlagiarismCheckAssignmentId(Number(e.target.value))}
                      className="admin-plagiarism-threshold-select admin-similarity-settings-select admin-similarity-toolbar-assignment"
                      aria-label="Assignment for quick similarity check"
                    >
                      {assignments.map(a => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    disabled={plagiarismCheckAssignmentId == null || plagiarismCheckingId != null}
                    onClick={() => {
                      if (plagiarismCheckAssignmentId != null) {
                        void handlePlagiarismCheck(plagiarismCheckAssignmentId, undefined, plagiarismCompareMode);
                      }
                    }}
                  >
                    {plagiarismCheckingId === plagiarismCheckAssignmentId ? 'Checking…' : 'Run check (no AI)'}
                  </button>
                </div>
              </div>
              {plagiarismCheckAssignmentId != null && renderRunProgressBar(
                plagiarismProgress.get(plagiarismCheckAssignmentId),
                'Checking similarity…',
                'similarity',
              )}
              {plagiarismCheckAssignmentId != null && plagiarismCheckStatus.get(plagiarismCheckAssignmentId) && (
                <p className={`admin-dashboard-message admin-similarity-toolbar-message${plagiarismCheckStatus.get(plagiarismCheckAssignmentId)?.isError ? ' error' : ''}`}>
                  {plagiarismCheckStatus.get(plagiarismCheckAssignmentId)?.msg}
                </p>
              )}
              {plagiarismCheckAssignmentId != null && (() => {
                const run = plagiarismResultsByAssignment.get(plagiarismCheckAssignmentId);
                const detailLines = run ? buildOverlapDetailLines(run) : [];
                if (!run || detailLines.length === 0) return null;
                return (
                  <div className="admin-overlap-results">
                    <span className="admin-overlap-results-title">Matches found</span>
                    <ul className="admin-overlap-results-list">
                      {detailLines.map(line => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </section>
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
              const submittedHomework = assignSubs.filter(s => !!s.notebook_url);
              const gradedCount = submittedHomework.filter(s => s.score != null).length;
              const submittedTotal = submittedHomework.length;
              const allGraded = submittedTotal > 0 && gradedCount === submittedTotal;
              const isOpen = expandedAssignments.has(a.id);
              const draft = editingAssignment.get(a.id);
              const isEditing = !!draft;
              const isPast = a.deadline ? parseCourseDate(a.deadline).getTime() < Date.now() : false;
              const isSelectionMode = selectionModeByAssignment.has(a.id);
              const selectedIds = selectedSubmissionIdsByAssignment.get(a.id) ?? new Set<number>();
              const selectedCount = selectedIds.size;
              const selectableIds = assignSubs.filter(s => !!s.notebook_url).map(s => s.id);
              const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
              const progress = gradingProgress.get(a.id);
              const similarityProgress = plagiarismProgress.get(a.id);
              const overlapRun = plagiarismResultsByAssignment.get(a.id);
              const hasOverlapResults = !!overlapRun;
              const plagiarismStatus = plagiarismCheckStatus.get(a.id);
              const isSetupBusy = uploadingRefId === a.id || generatingRubricId === a.id;
              const showAccordionStack = Boolean(
                gradingStatus.get(a.id)
                || (plagiarismStatus?.isError && !gradingStatus.get(a.id))
                || (overlapRun && !plagiarismStatus?.isError)
                || progress
                || similarityProgress
                || isSetupBusy
                || isOpen,
              );
              return (
                <li key={a.id} className={`admin-accordion-item${isEditing ? ' admin-accordion-item--editing' : ''}${actionsMenuId === a.id ? ' admin-accordion-item--menu-open' : ''}${isSetupBusy ? ' admin-accordion-item--busy' : ''}`}>
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
                        <span className="admin-assignment-statuses" aria-label="Assignment setup status">
                          {uploadingRefId === a.id ? (
                            <span className="admin-assignment-status admin-assignment-status--pending" title="Uploading reference notebook">Uploading ref…</span>
                          ) : a.reference_notebook ? (
                            <span className="admin-assignment-status admin-assignment-status--ok" title="Reference notebook uploaded">Ref</span>
                          ) : (
                            <span className="admin-assignment-status admin-assignment-status--warn" title="No reference notebook">No ref</span>
                          )}
                          {gradingMode === 'rubric' && (a.reference_notebook || uploadingRefId === a.id) && (
                            generatingRubricId === a.id ? (
                              <span className="admin-assignment-status admin-assignment-status--pending" title="Generating rubric">Rubric…</span>
                            ) : a.rubric ? (
                              <span className="admin-assignment-status admin-assignment-status--ok" title="Grading rubric ready">Rubric</span>
                            ) : (
                              <span className="admin-assignment-status admin-assignment-status--warn" title="Generate a rubric before grading">No rubric</span>
                            )
                          )}
                          {hasOverlapResults && overlapRun.flagged > 0 && (
                            <span className="admin-assignment-status admin-assignment-status--alert" title={`${overlapRun.flagged} overlap match(es) at ≥${overlapRun.thresholdPct}%`}>
                              {overlapRun.flagged} overlap
                            </span>
                          )}
                          {submittedTotal > 0 && (
                            <span
                              className={`admin-assignment-status admin-assignment-status--grade${
                                allGraded
                                  ? ' admin-assignment-status--ok'
                                  : gradedCount === 0
                                    ? ' admin-assignment-status--warn'
                                    : ' admin-assignment-status--partial'
                              }`}
                              title={`${gradedCount} of ${submittedTotal} submitted homeworks graded`}
                            >
                              {gradedCount}/{submittedTotal} graded
                            </span>
                          )}
                        </span>
                        {submittedTotal === 0 && (
                          <span className="admin-accordion-count">
                            {count === 0 ? 'No submissions' : `${count} submission${count !== 1 ? 's' : ''}`}
                          </span>
                        )}
                      </span>
                      <span className="admin-accordion-chevron">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    <span className="admin-accordion-actions" onClick={e => e.stopPropagation()}>
                      {gradingAssignmentId === a.id ? (
                        <button type="button" className="btn-danger btn-small" onClick={() => handleStopGrading(a.id)}>
                          Stop grading
                        </button>
                      ) : isSelectionMode && a.reference_notebook ? (
                        <>
                          <button
                            type="button"
                            className="btn-primary btn-small"
                            onClick={() => setConfirmGradeSelected({
                              assignmentId: a.id,
                              assignmentTitle: a.title,
                              selectedSubmissionIds: Array.from(selectedIds),
                            })}
                            disabled={selectedCount === 0 || (gradingMode === 'rubric' && !a.rubric)}
                            title={gradingMode === 'rubric' && !a.rubric ? 'Generate a rubric first' : undefined}
                          >
                            Grade selected ({selectedCount})
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => toggleSelectionMode(a.id)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : a.reference_notebook ? (
                        <button
                          type="button"
                          className="btn-primary btn-small"
                          onClick={() => setConfirmGrade({ assignmentId: a.id, assignmentTitle: a.title })}
                          disabled={gradingMode === 'rubric' && !a.rubric}
                          title={gradingMode === 'rubric' && !a.rubric ? 'Generate a rubric first' : undefined}
                        >
                          Grade
                        </button>
                      ) : null}
                      <div className="admin-assignment-menu">
                        <button
                          type="button"
                          className="btn-secondary btn-small admin-assignment-menu-trigger"
                          aria-expanded={actionsMenuId === a.id}
                          aria-haspopup="menu"
                          disabled={gradingAssignmentId === a.id}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            setActionsMenuId(prev => prev === a.id ? null : a.id);
                          }}
                          title="More actions"
                        >
                          ⋯
                        </button>
                        {actionsMenuId === a.id && (
                          <div className="admin-assignment-menu-panel" role="menu">
                            <div className="admin-assignment-menu-section">
                              <p className="admin-assignment-menu-label">Setup</p>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-assignment-menu-item"
                                disabled={uploadingRefId != null || generatingRubricId != null}
                                onClick={() => { setActionsMenuId(null); triggerRefUpload(a.id); }}
                              >
                                {uploadingRefId === a.id
                                  ? 'Uploading reference…'
                                  : a.reference_notebook ? 'Replace reference notebook' : 'Upload reference notebook'}
                              </button>
                              {(a.reference_notebook || uploadingRefId === a.id) && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-assignment-menu-item"
                                  disabled={uploadingRefId != null || generatingRubricId != null || !a.reference_notebook}
                                  onClick={() => { setActionsMenuId(null); void handleGenerateRubric(a.id); }}
                                >
                                  {generatingRubricId === a.id
                                    ? 'Generating rubric…'
                                    : a.rubric ? 'Regenerate rubric' : 'Generate rubric'}
                                  <span className="admin-assignment-menu-item-meta">
                                    {a.rubric ? 'Rubric ready' : 'Required for rubric grading'}
                                  </span>
                                </button>
                              )}
                              {a.rubric && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-assignment-menu-item"
                                  disabled={uploadingRefId != null || generatingRubricId != null || savingRubricId != null}
                                  onClick={() => {
                                    setActionsMenuId(null);
                                    startEditRubric(a.id, a.rubric!);
                                  }}
                                >
                                  Edit rubric
                                  <span className="admin-assignment-menu-item-meta">Adjust criteria manually</span>
                                </button>
                              )}
                            </div>
                            {count >= 2 || (a.reference_notebook && count >= 1) ? (
                              <div className="admin-assignment-menu-section">
                                <p className="admin-assignment-menu-label">Similarity</p>
                                {count >= 2 && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="admin-assignment-menu-item"
                                    disabled={plagiarismCheckingId != null}
                                    onClick={() => { setActionsMenuId(null); void handlePlagiarismCheck(a.id, undefined, 'students'); }}
                                  >
                                    {plagiarismCheckingId === a.id ? 'Checking students…' : 'Compare students'}
                                    <span className="admin-assignment-menu-item-meta">No AI · student ↔ student</span>
                                  </button>
                                )}
                                {a.reference_notebook && count >= 1 && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="admin-assignment-menu-item"
                                    disabled={plagiarismCheckingId != null}
                                    onClick={() => { setActionsMenuId(null); void handlePlagiarismCheck(a.id, undefined, 'reference'); }}
                                  >
                                    {plagiarismCheckingId === a.id ? 'Checking vs reference…' : 'Compare vs reference'}
                                    <span className="admin-assignment-menu-item-meta">No AI · vs professor solution</span>
                                  </button>
                                )}
                              </div>
                            ) : null}
                            {a.reference_notebook && (
                              <div className="admin-assignment-menu-section">
                                <p className="admin-assignment-menu-label">Grading</p>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="admin-assignment-menu-item"
                                  onClick={() => { setActionsMenuId(null); toggleSelectionMode(a.id); }}
                                >
                                  {isSelectionMode ? 'Cancel selection mode' : 'Select submissions to grade'}
                                </button>
                                {!isSelectionMode && (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="admin-assignment-menu-item"
                                    disabled={gradingMode === 'rubric' && !a.rubric}
                                    onClick={() => {
                                      setActionsMenuId(null);
                                      setConfirmGrade({ assignmentId: a.id, assignmentTitle: a.title });
                                    }}
                                  >
                                    Grade all submissions
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="admin-assignment-menu-section">
                              <p className="admin-assignment-menu-label">Assignment</p>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-assignment-menu-item"
                                onClick={() => { setActionsMenuId(null); startEdit(a); }}
                              >
                                {isEditing ? 'Close edit form' : 'Edit assignment'}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="admin-assignment-menu-item admin-assignment-menu-item--danger"
                                onClick={() => { setActionsMenuId(null); setConfirmDelete({ id: a.id, title: a.title }); }}
                              >
                                Delete assignment
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </span>
                  </div>
                  {showAccordionStack && (
                    <div className="admin-accordion-stack">
                  {isOpen && !isEditing && a.description?.trim() && (
                    <div className="admin-assignment-brief">
                      <span className="admin-assignment-brief-label">Description</span>
                      <p className="admin-assignment-brief-text">{a.description.trim()}</p>
                    </div>
                  )}
                  {isOpen && (() => {
                    const hasReference = !!a.reference_notebook;
                    const checkAllBlocked = assignmentSimilarityBlocked(plagiarismCompareMode, count, hasReference);
                    const checkSelectedBlocked = isSelectionMode
                      ? overlapSelectionRequirement(plagiarismCompareMode, selectedCount, hasReference)
                      : null;
                    const canCheckAll = plagiarismCheckingId == null && !checkAllBlocked;
                    const canCheckSelected = isSelectionMode
                      && selectedCount > 0
                      && plagiarismCheckingId == null
                      && !checkSelectedBlocked;
                    const isChecking = plagiarismCheckingId === a.id;
                    return (
                      <div className="admin-similarity-settings-bar admin-similarity-settings-bar--inline admin-accordion-panel">
                        <span className="admin-similarity-settings-bar-title">Similarity for this assignment</span>
                        <div className="admin-similarity-settings-bar-row">
                          {renderSimilaritySettingsControls({ idSuffix: `-${a.id}`, showHint: false })}
                          <div className="admin-similarity-settings-actions">
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              disabled={!canCheckAll}
                              title={checkAllBlocked ?? 'Check all submissions in this assignment'}
                              onClick={() => void handlePlagiarismCheck(a.id, undefined, plagiarismCompareMode)}
                            >
                              {isChecking ? 'Checking…' : 'Check all (no AI)'}
                            </button>
                            {isSelectionMode && (
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                disabled={!canCheckSelected}
                                title={checkSelectedBlocked ?? 'Check only the selected submissions'}
                                onClick={() => void handlePlagiarismCheck(a.id, Array.from(selectedIds), plagiarismCompareMode)}
                              >
                                {isChecking ? 'Checking…' : `Check selected (${selectedCount})`}
                              </button>
                            )}
                          </div>
                        </div>
                        {checkAllBlocked && !isSelectionMode && (
                          <p className="admin-similarity-settings-bar-note">{checkAllBlocked}</p>
                        )}
                        {isSelectionMode && checkSelectedBlocked && selectedCount > 0 && (
                          <p className="admin-similarity-settings-bar-note">{checkSelectedBlocked}</p>
                        )}
                        {isSelectionMode && checkAllBlocked && selectedCount === 0 && (
                          <p className="admin-similarity-settings-bar-note">{checkAllBlocked}</p>
                        )}
                      </div>
                    );
                  })()}
                  {gradingStatus.get(a.id) && (
                    <p className={`admin-dashboard-message admin-accordion-grade-msg${gradingError.get(a.id) ? ' error' : ''}`}>
                      {gradingStatus.get(a.id)}
                    </p>
                  )}
                  {plagiarismStatus?.isError && !gradingStatus.get(a.id) && (
                    <p className="admin-dashboard-message admin-accordion-grade-msg error">
                      {plagiarismStatus.msg}
                    </p>
                  )}
                  {overlapRun && !plagiarismStatus?.isError && (() => {
                    const detailLines = buildOverlapDetailLines(overlapRun);
                    return (
                      <div className="admin-overlap-accordion-summary">
                        <p className="admin-dashboard-message admin-accordion-grade-msg">
                          Overlap at ≥{overlapRun.thresholdPct}%: {overlapRun.flagged} of {overlapRun.total} flagged · {overlapRun.message}
                        </p>
                        {detailLines.length > 0 && (
                          <ul className="admin-overlap-results-list">
                            {detailLines.map(line => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })()}
                  {renderRunProgressBar(progress, 'Grading in progress…', 'grading')}
                  {renderRunProgressBar(similarityProgress, 'Checking similarity…', 'similarity')}

                  {isSetupBusy && (
                    <div className="admin-setup-activity admin-accordion-panel" role="status" aria-live="polite">
                      <span className="admin-setup-activity-spinner" aria-hidden />
                      <span>
                        {uploadingRefId === a.id
                          ? 'Uploading reference notebook…'
                          : 'Generating rubric with AI…'}
                      </span>
                    </div>
                  )}

                  {isOpen && a.rubric && (
                    <div className={`admin-rubric-panel admin-accordion-panel${freshRubricId === a.id ? ' admin-rubric-panel--fresh' : ''}`}>
                      <div className="admin-rubric-panel-head">
                        <span className="admin-rubric-panel-title">Grading rubric</span>
                        {a.rubric_generated_at && editingRubricId !== a.id && (
                          <span className="admin-rubric-panel-meta">
                            Generated {formatCourseDateTime(a.rubric_generated_at)}
                          </span>
                        )}
                        {editingRubricId === a.id && (
                          <span className="admin-rubric-panel-meta admin-rubric-panel-meta--edit">Editing</span>
                        )}
                        <div className="admin-rubric-panel-actions">
                          {editingRubricId === a.id ? (
                            <>
                              <button
                                type="button"
                                className="btn-primary btn-small"
                                onClick={() => void saveRubricEdit(a.id)}
                                disabled={savingRubricId === a.id}
                              >
                                {savingRubricId === a.id ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => cancelEditRubric(a.id)}
                                disabled={savingRubricId === a.id}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => startEditRubric(a.id, a.rubric!)}
                                disabled={generatingRubricId != null}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => setRubricPreviewId(prev => prev === a.id ? null : a.id)}
                              >
                                {rubricPreviewId === a.id ? 'Hide' : 'Show'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {editingRubricId === a.id && renderRubricEditor(a.id)}
                      {editingRubricId !== a.id && rubricPreviewId === a.id && renderRubricPreview(a.rubric)}
                    </div>
                  )}

                  {isOpen && (
                    <div className="admin-accordion-body">
                      {isSelectionMode && (
                        <div className="admin-selection-toolbar">
                          <div className="admin-selection-toolbar-head">
                            <span className="admin-selection-toolbar-title">Select submissions to grade</span>
                            <span className="admin-selection-count">{selectedCount} selected</span>
                          </div>
                          <p className="admin-selection-toolbar-hint">
                            Tick rows below, then use <strong>Grade selected</strong> in the header.
                            {' '}To compare code similarity, use <strong>Check selected</strong> in the similarity bar above.
                          </p>
                          <div className="admin-selection-toolbar-actions">
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => setSelectedSubmissionsForAssignment(a.id, allSelected ? [] : selectableIds)}
                            >
                              {allSelected ? 'Clear all' : 'Select all'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => setSelectedSubmissionsForAssignment(a.id, [])}
                              disabled={selectedCount === 0}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-small admin-selection-cancel"
                              onClick={() => toggleSelectionMode(a.id)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {isEditing && draft && (
                        <div className="admin-assignment-edit-form">
                          <input
                            type="text"
                            placeholder="Title"
                            value={draft.title}
                            onChange={e => updateDraft(a.id, 'title', e.target.value)}
                            required
                          />
                          <textarea
                            placeholder="Description (optional)"
                            value={draft.description}
                            onChange={e => updateDraft(a.id, 'description', e.target.value)}
                            rows={3}
                            className="admin-multiline-field"
                            aria-label="Assignment description"
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
                            {isSelectionMode && <th>Select</th>}
                            <th>Student</th>
                            <th>Notebook</th>
                            {hasOverlapResults && (
                              <th>
                                {overlapRun?.compareMode === 'reference'
                                  ? 'vs Reference'
                                  : overlapRun?.compareMode === 'both'
                                    ? 'Similarity'
                                    : 'Overlap'}
                              </th>
                            )}
                            <th>Score</th>
                            <th>Feedback</th>
                            <th>Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignSubs.length === 0 ? (
                            <tr><td colSpan={(isSelectionMode ? 6 : 5) + (hasOverlapResults ? 1 : 0)} className="admin-table-empty">No submissions yet.</td></tr>
                          ) : assignSubs.map(sub => {
                            const g = grades.get(sub.id) ?? { score: '', feedback: '' };
                            const role = sub.student?.role ? ` (${sub.student.role})` : '';
                            const overlap = overlapRun?.bySubmission.get(sub.id);
                            return (
                              <tr key={sub.id}>
                                {isSelectionMode && (
                                  <td data-label="Select">
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(sub.id)}
                                      onChange={() => toggleSubmissionSelection(a.id, sub.id)}
                                      disabled={!sub.notebook_url}
                                      aria-label={`Select submission ${sub.id}`}
                                    />
                                  </td>
                                )}
                                <td data-label="Student">
                                  {sub.student?.name
                                    ? <><strong>{sub.student.name}</strong>{role}</>
                                    : (sub.student?.email ?? '—') + role
                                  }
                                  <span className="admin-email-subtext">
                                    {sub.student?.email ?? ''}
                                  </span>
                                </td>
                                <td data-label="Notebook">
                                  {sub.notebook_url ? (
                                    <div className="admin-notebook-actions">
                                      <button
                                        type="button"
                                        className="btn-secondary btn-small"
                                        onClick={() => viewNotebook(sub.notebook_url!, sub.student?.name || sub.student?.email || 'Notebook')}
                                        disabled={loadingNotebook}
                                      >
                                        {loadingNotebook ? '…' : 'View'}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-secondary btn-small"
                                        onClick={() => downloadNotebook(
                                          sub.notebook_url!,
                                          sub.id,
                                          sub.student?.name || sub.student?.email || 'Notebook'
                                        )}
                                        disabled={downloadingSubmissionId === sub.id}
                                      >
                                        {downloadingSubmissionId === sub.id ? '…' : 'Download'}
                                      </button>
                                    </div>
                                  ) : '—'}
                                </td>
                                {hasOverlapResults && (
                                  <td data-label="Similarity">
                                    {overlap && overlapRun
                                      ? renderOverlapCell(overlap, overlapRun.compareMode)
                                      : <span className="admin-overlap-empty">—</span>}
                                  </td>
                                )}
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
                                          const { error } = await sb.from('submissions').update({
                                            verification_requested: false,
                                            verification_requested_at: null,
                                            verification_comment: null,
                                          }).eq('id', sub.id);
                                          if (error) return;
                                          patchSubmission(sub.id, {
                                            verification_requested: false,
                                            verification_requested_at: null,
                                            verification_comment: null,
                                          });
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="prereq-note admin-usage-note">
            Usage (in / out) is shown after each run.
          </p>
          </>
          )}
        </div>
      )}

      {/* Students */}
      {activeTab === 'students' && (
        <div className="admin-assignments-section">
          {loading ? (
            <p className="prereq-note">Loading…</p>
          ) : students.length === 0 ? (
            <>
              <h5 className="admin-section-title">Gradebook</h5>
              <p className="prereq-note sub-note--italic">No students enrolled yet.</p>
            </>
          ) : (
            <>
              <div className="admin-gradebook-section">
                <h5 className="admin-section-title">Gradebook</h5>
                {assignments.length === 0 ? (
                  <p className="prereq-note sub-note--italic">Add assignments to see grades here.</p>
                ) : (
                  <div className="dashboard-table-wrapper admin-table-responsive admin-gradebook-wrapper">
                    <table className="dashboard-table admin-gradebook-table">
                      <thead>
                        <tr>
                          <th className="admin-gradebook-sticky-col" scope="col">Student</th>
                          {assignments.map(a => (
                            <th key={a.id} scope="col" title={a.title}>
                              {shortenAssignmentTitle(a.title)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {buildGradebookRows().map(row => (
                          <tr key={row.student.student_id}>
                            <th className="admin-gradebook-sticky-col" scope="row" title={row.label}>
                              <span className="admin-gradebook-name">{row.label}</span>
                              {row.student.profile?.name && row.student.profile?.email && (
                                <span className="admin-gradebook-email" title={row.student.profile.email}>
                                  {row.student.profile.email}
                                </span>
                              )}
                            </th>
                            {row.scores.map((score, index) => (
                              <td
                                key={assignments[index].id}
                                data-label={assignments[index].title}
                                className={score == null ? 'admin-gradebook-empty' : 'admin-gradebook-score'}
                              >
                                {score != null ? score : '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="admin-enrollment-section">
                <h5 className="admin-section-title">Enrollment</h5>
                <div className="dashboard-table-wrapper admin-table-responsive">
                  <table className="dashboard-table admin-students-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Enrolled</th>
                        <th>Submissions</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => {
                        const subCount = submissions.filter(sub =>
                          sub.student?.email === s.profile?.email
                        ).length;
                        const label = s.profile?.name || s.profile?.email || 'this student';
                        return (
                          <tr key={s.student_id}>
                            <td data-label="Name"><strong>{s.profile?.name ?? '—'}</strong></td>
                            <td data-label="Email">{s.profile?.email ?? '—'}</td>
                            <td data-label="Enrolled">{s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString() : '—'}</td>
                            <td data-label="Submissions">{subCount} / {assignments.length}</td>
                            <td data-label="Actions">
                              <button
                                type="button"
                                className="btn-danger btn-small"
                                onClick={() => setConfirmRemoveStudent({ id: s.student_id, label })}
                                disabled={removingStudentId === s.student_id}
                                title="Remove from this course"
                              >
                                {removingStudentId === s.student_id ? '…' : 'Remove'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </div>
      {/* end .admin-content */}
      </div>
      {/* end .admin-layout */}

      {/* Hidden file input for reference notebook uploads */}
      <input ref={refInputRef} type="file" accept=".ipynb" className="u-hidden-file-input" onChange={handleRefFileSelected} />

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

      {confirmRemoveStudent && (
        <ConfirmDialog
          title="Remove student from course?"
          message={`Remove "${confirmRemoveStudent.label}" from this course? Their enrollment will be deleted, but existing submissions and grades will be kept for records.`}
          confirmLabel="Remove"
          onConfirm={confirmRemoveStudentFromCourse}
          onCancel={() => setConfirmRemoveStudent(null)}
        />
      )}

      {confirmGrade && (
        <ConfirmDialog
          title="Grade all submissions?"
          message={`Grade all submissions for "${confirmGrade.assignmentTitle}"? Mode: ${gradingMode}. Already-graded submissions will be skipped unless you re-run with force. Overlap threshold: ${plagiarismThresholdPct}%.`}
          confirmLabel="Grade all"
          confirmVariant="primary"
          onConfirm={() => {
            handleGradeAll(confirmGrade.assignmentId);
            setConfirmGrade(null);
          }}
          onCancel={() => setConfirmGrade(null)}
        />
      )}

      {confirmGradeSelected && (
        <ConfirmDialog
          title="Grade selected submissions?"
          message={`Grade ${confirmGradeSelected.selectedSubmissionIds.length} selected submission(s) for "${confirmGradeSelected.assignmentTitle}"? Mode: ${gradingMode}. Overlap threshold: ${plagiarismThresholdPct}%.`}
          confirmLabel="Grade selected"
          confirmVariant="primary"
          onConfirm={() => {
            handleGradeSelected(
              confirmGradeSelected.assignmentId,
              confirmGradeSelected.selectedSubmissionIds
            );
            setConfirmGradeSelected(null);
          }}
          onCancel={() => setConfirmGradeSelected(null)}
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
