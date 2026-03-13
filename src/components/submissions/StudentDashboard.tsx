'use client';

import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Assignment, Submission } from '@/types/submissions';

interface Props {
  user: User;
  onLogout: () => void;
}

export default function StudentDashboard({ user, onLogout }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const sb = getSupabase();
      if (!sb) return;
      setLoading(true);
      try {
        const [assignRes, subRes] = await Promise.all([
          sb.from('assignments').select('id, title').order('id'),
          sb
            .from('submissions')
            .select('id, assignment_id, score, feedback, created_at')
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
    load();
  }, [user.id]);

  // Latest submission per assignment
  const latestByAssignment = new Map<number, Submission>();
  for (const s of submissions) {
    if (!latestByAssignment.has(s.assignment_id)) {
      latestByAssignment.set(s.assignment_id, s);
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h4 className="dashboard-title">Your submissions &amp; grades</h4>
        <button className="btn-secondary btn-small" onClick={onLogout} type="button">
          Log out
        </button>
      </div>
      <p className="prereq-note dashboard-user-line">
        Logged in as <strong>{user.email}</strong>
      </p>

      {loading && <p className="prereq-note">Loading…</p>}
      {error && <p className="prereq-note" style={{ color: '#b00020' }}>{error}</p>}

      {!loading && !error && (
        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Status</th>
                <th>Grade</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    No assignments yet.
                  </td>
                </tr>
              ) : (
                assignments.map(a => {
                  const sub = latestByAssignment.get(a.id);
                  return (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td>{sub ? 'Submitted' : 'Not submitted'}</td>
                      <td>{sub?.score != null ? sub.score : '–'}</td>
                      <td>
                        {sub?.created_at
                          ? new Date(sub.created_at).toLocaleDateString()
                          : '–'}
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
