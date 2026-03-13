'use client';

import { useState, useEffect, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { Course } from '@/types/submissions';

interface Props {
  user: User;
  isAdmin: boolean;
  onSelect: (course: Course) => void;
  onLogout: () => void;
}

export default function CourseSelector({ user, isAdmin, onSelect, onLogout }: Props) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [openCourses, setOpenCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Admin create form
  const [newName, setNewName] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  function showMsg(text: string, error = false) { setMessage(text); setIsError(error); }

  useEffect(() => {
    async function load() {
      const sb = getSupabase();
      if (!sb) return;
      setLoading(true);
      if (isAdmin) {
        const { data, error } = await sb.from('courses').select('*').order('created_at', { ascending: false });
        if (!error) setCourses(data ?? []);
      } else {
        // enrolled courses
        const { data: enrolled } = await sb
          .from('enrollments')
          .select('course_id')
          .eq('student_id', user.id);
        const enrolledIds = (enrolled ?? []).map(e => e.course_id);

        const { data: available } = await sb
          .from('courses')
          .select('*')
          .order('created_at', { ascending: false });

        const all = available ?? [];
        setCourses(all.filter(c => enrolledIds.includes(c.id)));
        setOpenCourses(all.filter(c => c.signups_open && !enrolledIds.includes(c.id)));
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !newName.trim()) return;
    setCreating(true);
    showMsg('Creating course…');
    const { data, error } = await sb
      .from('courses')
      .insert({ name: newName.trim(), term: newTerm.trim() || null, description: newDesc.trim() || null, signups_open: false })
      .select()
      .single();
    if (error) { showMsg('Failed: ' + error.message, true); setCreating(false); return; }
    showMsg('');
    setNewName(''); setNewTerm(''); setNewDesc('');
    setCreating(false);
    if (data) onSelect(data as Course);
  }

  async function handleJoin(courseId: number) {
    const sb = getSupabase();
    if (!sb) return;
    showMsg('Enrolling…');
    const { error } = await sb.from('enrollments').insert({ student_id: user.id, course_id: courseId });
    if (error) { showMsg('Failed to enroll: ' + error.message, true); return; }
    const course = openCourses.find(c => c.id === courseId);
    if (course) onSelect(course);
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h4 className="dashboard-title">{isAdmin ? 'Courses' : 'My courses'}</h4>
        <button className="btn-secondary btn-small" type="button" onClick={onLogout}>Log out</button>
      </div>
      <p className="prereq-note dashboard-user-line">
        Logged in as <strong>{user.email}</strong>
        {isAdmin && <span className="admin-badge">Admin</span>}
      </p>

      {message && <p className={`admin-dashboard-message${isError ? ' error' : ''}`}>{message}</p>}

      {loading ? <p className="prereq-note">Loading…</p> : (
        <>
          {/* Enrolled / existing courses */}
          {courses.length === 0 && !isAdmin ? (
            <p className="prereq-note" style={{ fontStyle: 'italic' }}>
              You are not enrolled in any course yet.{openCourses.length > 0 ? ' Join one below.' : ''}
            </p>
          ) : (
            <ul className="course-list">
              {courses.map(c => (
                <li key={c.id} className="course-list-item">
                  <div className="course-list-info">
                    <strong>{c.name}</strong>
                    {c.term && <span className="course-term">{c.term}</span>}
                    {c.description && <span className="course-desc">{c.description}</span>}
                    {isAdmin && (
                      <span className={`signup-status-badge ${c.signups_open ? 'open' : 'closed'}`}>
                        {c.signups_open ? 'Registrations open' : 'Registrations closed'}
                      </span>
                    )}
                  </div>
                  <button type="button" className="btn-primary btn-small" onClick={() => onSelect(c)}>
                    Open →
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Student: open courses to join */}
          {!isAdmin && openCourses.length > 0 && (
            <>
              <h5 className="admin-section-title" style={{ marginTop: '1.25rem' }}>Available to join</h5>
              <ul className="course-list">
                {openCourses.map(c => (
                  <li key={c.id} className="course-list-item">
                    <div className="course-list-info">
                      <strong>{c.name}</strong>
                      {c.term && <span className="course-term">{c.term}</span>}
                    </div>
                    <button type="button" className="btn-primary btn-small" onClick={() => handleJoin(c.id)}>
                      Join →
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Admin: create new course */}
          {isAdmin && (
            <>
              <h5 className="admin-section-title" style={{ marginTop: '1.25rem' }}>Create new course</h5>
              <form className="admin-assignment-form" onSubmit={handleCreate}>
                <div className="admin-assignment-fields">
                  <input type="text" placeholder="Course name" value={newName} onChange={e => setNewName(e.target.value)} required disabled={creating} />
                  <input type="text" placeholder="Term (e.g. 2025-1)" value={newTerm} onChange={e => setNewTerm(e.target.value)} disabled={creating} />
                  <input type="text" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} disabled={creating} />
                </div>
                <button type="submit" className="btn-primary btn-small" disabled={creating}>Create &amp; open</button>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}
