'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Assignment, Submission, Course } from '@/types/submissions';

interface Props {
  user: User;
  course: Course;
  onLogout: () => void;
  onBack: () => void;
}

const BUCKET = 'student-notebooks';

export default function StudentDashboard({ user, course, onLogout, onBack }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Expanded feedback per assignment
  const [expandedFeedback, setExpandedFeedback] = useState<Set<number>>(new Set());
  const toggleFeedback = useCallback((id: number) => {
    setExpandedFeedback(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const PREVIEW_LEN = 80;

  // Per-assignment upload state: assignmentId → status message
  const [uploadStatus, setUploadStatus] = useState<Map<number, string>>(new Map());
  const [uploadError, setUploadError] = useState<Map<number, boolean>>(new Map());
  const [uploading, setUploading] = useState<Set<number>>(new Set());

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
          .select('id, assignment_id, notebook_url, score, feedback, created_at')
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

  async function openNotebook(pathOrUrl: string) {
    const sb = getSupabase();
    if (!sb) return;
    // Legacy rows stored the full public URL; extract just the path after the bucket name
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
          <button className="btn-secondary btn-small" onClick={onBack} type="button">← Courses</button>
          <h4 className="dashboard-title">{course.name}{course.term ? ` · ${course.term}` : ''}</h4>
        </div>
        <button className="btn-secondary btn-small" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
      <p className="prereq-note dashboard-user-line">
        Logged in as <strong>{user.email}</strong>
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
                            onClick={() => openNotebook(sub.notebook_url!)}
                          >
                            View ↗
                          </button>
                        ) : '—'}
                      </td>
                      <td>{sub?.score != null ? `${sub.score}/10` : '–'}</td>
                      <td className="feedback-cell">
                        {sub?.feedback ? (() => {
                          const text = sub.feedback;
                          const isLong = text.length > PREVIEW_LEN;
                          const expanded = expandedFeedback.has(a.id);
                          return (
                            <>
                              <span className="feedback-text">
                                {isLong && !expanded
                                  ? text.slice(0, PREVIEW_LEN) + '…'
                                  : text}
                              </span>
                              {isLong && (
                                <button
                                  type="button"
                                  className="read-more-btn"
                                  onClick={() => toggleFeedback(a.id)}
                                >
                                  {expanded ? 'Show less ↑' : 'Show more ↓'}
                                </button>
                              )}
                            </>
                          );
                        })() : '–'}
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
    </div>
  );
}
