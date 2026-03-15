'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Assignment, Submission, Course } from '@/types/submissions';
import NotebookViewer from './NotebookViewer';

interface Props {
  user: User;
  course: Course;
  onLogout: () => void;
  onBack: () => void;
}

const BUCKET = 'student-notebooks';
/** Max notebook size (MB). Must match Supabase Storage bucket limit. */
const MAX_NOTEBOOK_MB = 2;

export default function StudentDashboard({ user, course, onLogout, onBack }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [feedbackModal, setFeedbackModal] = useState<{
    assignmentTitle: string;
    score: number | null;
    feedback: string;
  } | null>(null);

  const FEEDBACK_PREVIEW_CHARS = 48;

  // Per-assignment upload state: assignmentId → status message
  const [uploadStatus, setUploadStatus] = useState<Map<number, string>>(new Map());
  const [uploadError, setUploadError] = useState<Map<number, boolean>>(new Map());
  const [uploading, setUploading] = useState<Set<number>>(new Set());
  const [viewingNotebook, setViewingNotebook] = useState<{ title: string; notebook: Record<string, unknown> } | null>(null);
  const [loadingNotebook, setLoadingNotebook] = useState(false);
  const [requestingVerification, setRequestingVerification] = useState<number | null>(null);

  // One hidden file input, re-used for each assignment
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAssignmentId = useRef<number | null>(null);

  async function loadData() {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    try {
      const [assignRes, subRes] = await Promise.all([
        sb.from('assignments').select('id, title, deadline').eq('course_id', course.id).order('id'),
        sb
          .from('submissions')
          .select('id, assignment_id, notebook_url, score, feedback, created_at, verification_requested, verification_requested_at')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (assignRes.error) throw assignRes.error;
      if (subRes.error) throw subRes.error;
      setAssignments(assignRes.data ?? []);
      setSubmissions((subRes.data ?? []) as unknown as Submission[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Latest submission per assignment (most recent first since ordered DESC)
  const latestByAssignment = new Map<number, Submission>();
  for (const s of submissions) {
    if (!latestByAssignment.has(s.assignment_id)) {
      latestByAssignment.set(s.assignment_id, s);
    }
  }

  function getStoragePath(pathOrUrl: string): string {
    const marker = `/${BUCKET}/`;
    if (pathOrUrl.startsWith('https://')) {
      const idx = pathOrUrl.indexOf(marker);
      return idx !== -1 ? pathOrUrl.slice(idx + marker.length) : pathOrUrl;
    }
    return pathOrUrl;
  }

  async function requestVerification(submissionId: number) {
    const sb = getSupabase();
    if (!sb) return;
    setRequestingVerification(submissionId);
    try {
      const { error } = await sb.rpc('request_submission_verification', { sub_id: submissionId });
      if (error) throw new Error(error.message);
      await loadData();
    } catch (e) {
      alert('Could not submit request: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRequestingVerification(null);
    }
  }

  async function viewNotebook(pathOrUrl: string, title: string) {
    const storagePath = getStoragePath(pathOrUrl);
    setLoadingNotebook(true);
    setViewingNotebook(null);
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Not configured');
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, 60);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No URL');
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error('Fetch failed');
      const json = await res.json();
      setViewingNotebook({ title, notebook: json });
    } catch (e) {
      alert('Could not load notebook: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoadingNotebook(false);
    }
  }

  function setStatus(assignmentId: number, msg: string, isError = false) {
    setUploadStatus(prev => new Map(prev).set(assignmentId, msg));
    setUploadError(prev => new Map(prev).set(assignmentId, isError));
  }

  function triggerUpload(assignmentId: number) {
    pendingAssignmentId.current = assignmentId;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const assignmentId = pendingAssignmentId.current;
    if (!file || assignmentId === null) return;

    if (!file.name.endsWith('.ipynb')) {
      setStatus(assignmentId, 'Only .ipynb files are accepted.', true);
      return;
    }
    const maxBytes = MAX_NOTEBOOK_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setStatus(assignmentId, `File too large. Maximum size is ${MAX_NOTEBOOK_MB} MB.`, true);
      return;
    }

    const sb = getSupabase();
    if (!sb) return setStatus(assignmentId, 'Auth service unavailable.', true);

    setUploading(prev => new Set(prev).add(assignmentId));
    setStatus(assignmentId, 'Uploading…');

    const timestamp = Date.now();
    const storagePath = `${user.id}/${assignmentId}_${timestamp}.ipynb`;

    try {
      // 1 — Upload file to storage
      const { error: uploadErr } = await sb.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: 'application/json', upsert: false });
      if (uploadErr) throw uploadErr;

      // 2 — Store the storage path (not a public URL) so we can generate signed URLs later
      const { error: insertErr } = await sb.from('submissions').insert({
        student_id: user.id,
        assignment_id: assignmentId,
        notebook_url: storagePath,
      });
      if (insertErr) throw insertErr;

      setStatus(assignmentId, 'Uploaded successfully ✓');
      await loadData();
    } catch (err: unknown) {
      setStatus(assignmentId, 'Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), true);
    } finally {
      setUploading(prev => { const s = new Set(prev); s.delete(assignmentId); return s; });
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button className="btn-back-courses" onClick={onBack} type="button" aria-label="Back to courses">← Courses</button>
          <h4 className="dashboard-title">{course.name}{course.term ? ` · ${course.term}` : ''}</h4>
        </div>
        <button className="btn-secondary btn-small" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
      <p className="prereq-note dashboard-user-line">
        Logged in as <strong>{user.email}</strong>
      </p>
      <p className="prereq-note" style={{ marginBottom: '0.5rem' }}>
        Maximum notebook size: <strong>{MAX_NOTEBOOK_MB} MB</strong>. Only <code>.ipynb</code> files are accepted.
      </p>

      {/* Hidden file input shared by all rows */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".ipynb"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {loading && <p className="prereq-note">Loading…</p>}
      {error && <p className="prereq-note" style={{ color: '#b00020' }}>{error}</p>}

      {!loading && !error && (
        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Notebook</th>
                <th>Grade</th>
                <th>Feedback</th>
                <th>Upload</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                      <td colSpan={7} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    No assignments yet.
                  </td>
                </tr>
              ) : (
                assignments.map(a => {
                  const sub = latestByAssignment.get(a.id);
                  const isUploading = uploading.has(a.id);
                  const statusMsg = uploadStatus.get(a.id) ?? '';
                  const statusIsErr = uploadError.get(a.id) ?? false;
                  const isPastDeadline = a.deadline ? new Date(a.deadline) < new Date() : false;
                  const uploadBlocked = isPastDeadline;

                  return (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>
                        {a.deadline ? (
                          <span className={isPastDeadline ? 'deadline-badge deadline-past' : 'deadline-badge'}>
                            {isPastDeadline ? '⏰ Closed ' : '⏰ '}
                            {new Date(a.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        {sub ? 'Submitted' : isPastDeadline
                          ? <span style={{ color: '#b00020' }}>Not submitted</span>
                          : 'Not submitted'}
                      </td>
                      <td>
                        {sub?.notebook_url ? (
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => viewNotebook(sub.notebook_url!, a.title)}
                            disabled={loadingNotebook}
                          >
                            {loadingNotebook ? '…' : 'View'}
                          </button>
                        ) : '—'}
                      </td>
                      <td>{sub?.score != null ? `${sub.score}/10` : '–'}</td>
                      <td className="feedback-cell">
                        {sub?.feedback ? (
                          <div className="feedback-preview">
                            <span className="feedback-preview-text">
                              {sub.feedback.length > FEEDBACK_PREVIEW_CHARS
                                ? sub.feedback.slice(0, FEEDBACK_PREVIEW_CHARS).trim() + '…'
                                : sub.feedback}
                            </span>
                            <button
                              type="button"
                              className="feedback-view-btn"
                              onClick={() => setFeedbackModal({
                                assignmentTitle: a.title,
                                score: sub?.score ?? null,
                                feedback: sub.feedback ?? '',
                              })}
                            >
                              View feedback
                            </button>
                            {sub.score != null && (
                              sub.verification_requested ? (
                                <span className="verification-badge verification-requested">Verification requested</span>
                              ) : (
                                <button
                                  type="button"
                                  className="feedback-view-btn"
                                  onClick={() => requestVerification(sub.id)}
                                  disabled={requestingVerification === sub.id}
                                >
                                  {requestingVerification === sub.id ? 'Requesting…' : 'Request verification'}
                                </button>
                              )
                            )}
                          </div>
                        ) : '–'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-primary btn-small"
                          onClick={() => triggerUpload(a.id)}
                          disabled={isUploading || uploadBlocked}
                          title={uploadBlocked ? 'Deadline has passed' : undefined}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {isUploading ? 'Uploading…' : uploadBlocked ? 'Closed' : sub ? 'Re-upload' : 'Upload .ipynb'}
                        </button>
                        {statusMsg && (
                          <p
                            className="auth-message"
                            style={{ color: statusIsErr ? '#b00020' : 'var(--text-muted)', marginTop: '4px' }}
                          >
                            {statusMsg}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {feedbackModal && (
        <div className="feedback-modal-overlay" onClick={() => setFeedbackModal(null)}>
          <div className="feedback-modal" onClick={e => e.stopPropagation()}>
            <div className="feedback-modal-header">
              <h5 className="feedback-modal-title">{feedbackModal.assignmentTitle}</h5>
              <button type="button" className="btn-secondary btn-small" onClick={() => setFeedbackModal(null)}>
                Close
              </button>
            </div>
            <div className="feedback-modal-body">
              {feedbackModal.score != null && (
                <div className="feedback-score-badge">
                  Score: <strong>{feedbackModal.score}/10</strong>
                </div>
              )}
              <div className="feedback-modal-text">
                {feedbackModal.feedback}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingNotebook && (
        <div className="notebook-modal-overlay" onClick={() => setViewingNotebook(null)}>
          <div className="notebook-modal" onClick={e => e.stopPropagation()}>
            <div className="notebook-modal-header">
              <h5 className="notebook-modal-title">{viewingNotebook.title}</h5>
              <button type="button" className="btn-secondary btn-small" onClick={() => setViewingNotebook(null)}>
                Close
              </button>
            </div>
            <div className="notebook-modal-body">
              <NotebookViewer notebook={viewingNotebook.notebook} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
