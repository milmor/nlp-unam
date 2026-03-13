'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { AuthState, UserRole, Course } from '@/types/submissions';
import AuthPanel from '@/components/submissions/AuthPanel';
import CourseSelector from '@/components/submissions/CourseSelector';
import StudentDashboard from '@/components/submissions/StudentDashboard';
import AdminDashboard from '@/components/submissions/AdminDashboard';
import ApiStatus from '@/components/submissions/ApiStatus';
import UsageStats from '@/components/submissions/UsageStats';
import ResetPasswordForm from '@/components/submissions/ResetPasswordForm';

export default function SubmissionsPage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const resolveRole = useCallback(async (u: User): Promise<UserRole> => {
    const sb = getSupabase();
    if (!sb) return 'student';
    const { data } = await sb.from('profiles').select('role').eq('id', u.id).single();
    return (data?.role as UserRole) ?? 'student';
  }, []);

  const handleUser = useCallback(async (u: User | null) => {
    if (!u) { setUser(null); setAuthState('unauthenticated'); setSelectedCourse(null); return; }
    setUser(u);
    const role = await resolveRole(u);
    setAuthState(role === 'admin' ? 'admin' : 'student');
  }, [resolveRole]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setAuthState('unauthenticated'); return; }
    sb.auth.getSession().then(({ data }) => handleUser(data.session?.user ?? null));
    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setUser(session?.user ?? null);
        setRecovering(true);
        setAuthState('unauthenticated');
        return;
      }
      handleUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [handleUser]);

  const handleLogout = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setRecovering(false);
    setSelectedCourse(null);
    setAuthState('unauthenticated');
  };

  const handleResetDone = () => { setRecovering(false); setAuthState('unauthenticated'); };

  const isAuthView = authState === 'unauthenticated' || authState === 'loading' || recovering;
  const showCourseSelector = !recovering && (authState === 'admin' || authState === 'student') && !selectedCourse;
  const showDashboard = !recovering && selectedCourse && (authState === 'admin' || authState === 'student');

  return (
    <section className="section">
      <div className="container">
        <div className={isAuthView ? 'submissions-auth-wrapper' : ''}>
          <h2>Homework Submissions</h2>
          <p className="section-intro">
            Authenticate below to view your submissions and grades for the course programming assignments.
          </p>

          <div className="detail-card submissions-main-card">
            {authState === 'loading' && <p className="prereq-note">Loading…</p>}

            {recovering && <ResetPasswordForm onDone={handleResetDone} />}

            {!recovering && authState === 'unauthenticated' && <AuthPanel onAuth={handleUser} />}

            {showCourseSelector && user && (
              <CourseSelector
                user={user}
                isAdmin={authState === 'admin'}
                onSelect={setSelectedCourse}
                onLogout={handleLogout}
              />
            )}

            {showDashboard && user && authState === 'student' && (
              <StudentDashboard
                user={user}
                course={selectedCourse!}
                onLogout={handleLogout}
                onBack={() => setSelectedCourse(null)}
              />
            )}

            {showDashboard && user && authState === 'admin' && (
              <AdminDashboard
                user={user}
                course={selectedCourse!}
                onLogout={handleLogout}
                onBack={() => setSelectedCourse(null)}
              />
            )}
          </div>
        </div>

        {/* API status + usage stats — admin only, course selected */}
        {authState === 'admin' && selectedCourse && (
          <div className="detail-card submissions-api-card">
            <ApiStatus />
            <UsageStats />
          </div>
        )}
      </div>
    </section>
  );
}
