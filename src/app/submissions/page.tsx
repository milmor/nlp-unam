'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { AuthState, UserRole } from '@/types/submissions';
import AuthPanel from '@/components/submissions/AuthPanel';
import StudentDashboard from '@/components/submissions/StudentDashboard';
import AdminDashboard from '@/components/submissions/AdminDashboard';
import ApiStatus from '@/components/submissions/ApiStatus';
import ResetPasswordForm from '@/components/submissions/ResetPasswordForm';

export default function SubmissionsPage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [recovering, setRecovering] = useState(false);

  const resolveRole = useCallback(async (u: User): Promise<UserRole> => {
    const sb = getSupabase();
    if (!sb) return 'student';
    const { data } = await sb
      .from('profiles')
      .select('role')
      .eq('id', u.id)
      .single();
    return (data?.role as UserRole) ?? 'student';
  }, []);

  const handleUser = useCallback(
    async (u: User | null) => {
      if (!u) {
        setUser(null);
        setAuthState('unauthenticated');
        return;
      }
      setUser(u);
      const role = await resolveRole(u);
      setAuthState(role === 'admin' ? 'admin' : 'student');
    },
    [resolveRole]
  );

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setAuthState('unauthenticated');
      return;
    }

    // Restore existing session on mount
    sb.auth.getSession().then(({ data }) => {
      handleUser(data.session?.user ?? null);
    });

    // Listen for auth events — including PASSWORD_RECOVERY
    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User arrived via a reset-password email link
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
    setAuthState('unauthenticated');
  };

  const handleResetDone = () => {
    setRecovering(false);
    setAuthState('unauthenticated');
  };

  const isAuthView = authState === 'unauthenticated' || authState === 'loading' || recovering;

  return (
    <section className="section">
      <div className="container">
        {/* Wrap heading + card in the same narrow column when showing auth */}
        <div className={isAuthView ? 'submissions-auth-wrapper' : ''}>
          <h2>Homework Submissions</h2>
          <p className="section-intro">
            Authenticate below to view your submissions and grades for the course programming assignments.
          </p>

        {/* Main dashboard card */}
        <div className="detail-card submissions-main-card">
          {authState === 'loading' && (
            <p className="prereq-note">Loading…</p>
          )}

          {recovering && (
            <ResetPasswordForm onDone={handleResetDone} />
          )}

          {!recovering && authState === 'unauthenticated' && (
            <AuthPanel onAuth={handleUser} />
          )}

          {!recovering && authState === 'student' && user && (
            <StudentDashboard user={user} onLogout={handleLogout} />
          )}

          {!recovering && authState === 'admin' && user && (
            <AdminDashboard user={user} onLogout={handleLogout} />
          )}
        </div>
        </div>{/* end auth-wrapper or fragment */}

        {/* API status — below dashboard, admin only */}
        {authState === 'admin' && (
          <div className="detail-card submissions-api-card">
            <ApiStatus />
          </div>
        )}
      </div>
    </section>
  );
}
