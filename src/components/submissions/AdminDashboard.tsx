'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Assignment, AdminSubmission } from '@/types/submissions';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function AdminDashboard({ user, onLogout }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  // Inline deadline editing: assignmentId → draft datetime-local string
  const [editingDeadline, setEditingDeadline] = useState<Map<number, string>>(new Map());

  function startEditDeadline(a: Assignment) {
    const value = a.deadline
      ? new Date(new Date(a.deadline).getTime() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : '';
    setEditingDeadline(prev => new Map(prev).set(a.id, value));
  }

  function cancelEditDeadline(id: number) {
    setEditingDeadline(prev => { const m = new Map(prev); m.delete(id); return m; });
  }

  async function saveDeadline(id: number) {
    const sb = getSupabase();
    if (!sb) return;
    const raw = editingDeadline.get(id) ?? '';
    const deadline = raw ? new Date(raw).toISOString() : null;
    const { error } = await sb.from('assignments').update({ deadline }).eq('id', id);
    if (error) return showMsg('Failed to save deadline: ' + error.message, true);
    cancelEditDeadline(id);
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

  async function loadData() {
    const sb = getSupabase();
    if (!sb) return;
    setLoading(true);
    showMsg('');
    try {
      const [assignRes, subRes] = await Promise.all([
        sb.from('assignments').select('id, title, description, deadline').order('id'),
        sb
          .from('submissions')
          .select(
            'id, notebook_url, score, feedback, created_at, student:profiles!fk_student(email, role), assignment:assignments!fk_assignment(title)'
          )
          .order('created_at', { ascending: false }),
      ]);
      if (assignRes.error) throw assignRes.error;
      if (subRes.error) throw subRes.error;
      setAssignments(assignRes.data ?? []);
      setSubmissions((subRes.data ?? []) as unknown as AdminSubmission[]);
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : 'Failed to load data.', true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddAssignment(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const sb = getSupabase();
    if (!sb) return;
    showMsg('Adding assignment…');
    const payload: Record<string, unknown> = { title };
    if (newDesc.trim()) payload.description = newDesc.trim();
    if (newDeadline) payload.deadline = new Date(newDeadline).toISOString();
    const { error } = await sb.from('assignments').insert([payload]);
    if (error) return showMsg('Failed to add: ' + error.message, true);
    setNewTitle('');
    setNewDesc('');
    setNewDeadline('');
    loadData();
  }

  async function handleDeleteAssignment(id: number) {
    const sb = getSupabase();
    if (!sb) return;
    showMsg('Deleting…');
    const { error } = await sb.from('assignments').delete().eq('id', id);
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
        <h4 className="dashboard-title">Admin — Student submissions &amp; grades</h4>
        <button className="btn-secondary btn-small" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
      <p className="prereq-note dashboard-user-line">
        Logged in as <strong>{user.email}</strong>{' '}
        <span className="admin-badge">Admin</span>
      </p>

      {message && (
        <p className={`admin-dashboard-message${isError ? ' error' : ''}`}>{message}</p>
      )}

      {/* Assignments management */}
      <div className="admin-assignments-section">
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
                const isEditingDl = editingDeadline.has(a.id);
                const isPast = a.deadline ? new Date(a.deadline) < new Date() : false;
                return (
                  <li key={a.id} className="admin-assignment-item">
                    <span>
                      <strong>{a.title}</strong>
                      {a.description ? `: ${a.description}` : ''}
                      {!isEditingDl && a.deadline && (
                        <span className={`deadline-badge${isPast ? ' deadline-past' : ''}`}>
                          {isPast ? '⏰ Closed' : '⏰ Due'}{' '}
                          {new Date(a.deadline).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </span>
                    <span className="admin-assignment-actions">
                      {isEditingDl ? (
                        <>
                          <input
                            type="datetime-local"
                            value={editingDeadline.get(a.id) ?? ''}
                            onChange={e =>
                              setEditingDeadline(prev => new Map(prev).set(a.id, e.target.value))
                            }
                          />
                          <button
                            type="button"
                            className="btn-primary btn-small"
                            onClick={() => saveDeadline(a.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => cancelEditDeadline(a.id)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary btn-small"
                          onClick={() => startEditDeadline(a)}
                        >
                          {a.deadline ? 'Edit deadline' : 'Set deadline'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => handleDeleteAssignment(a.id)}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {/* All submissions */}
      <div className="admin-submissions-section">
        <h5 className="admin-section-title">All submissions</h5>
        <div className="dashboard-table-wrapper">
          <table className="dashboard-table admin-submissions-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Assignment</th>
                <th>Notebook</th>
                <th>Score</th>
                <th>Feedback</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="admin-table-empty">Loading…</td></tr>
              ) : submissions.length === 0 ? (
                <tr><td colSpan={6} className="admin-table-empty">No submissions yet.</td></tr>
              ) : (
                submissions.map(sub => {
                  const g = grades.get(sub.id) ?? { score: '', feedback: '' };
                  const studentEmail = sub.student?.email ?? '—';
                  const role = sub.student?.role ? ` (${sub.student.role})` : '';
                  return (
                    <tr key={sub.id}>
                      <td>{studentEmail}{role}</td>
                      <td>{sub.assignment?.title ?? '—'}</td>
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
                      <td>
                        {sub.created_at
                          ? new Date(sub.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
