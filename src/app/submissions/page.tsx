'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { AuthState, UserRole } from '@/types/submissions';
import AuthPanel from '@/components/submissions/AuthPanel';
import StudentDashboard from '@/components/submissions/StudentDashboard';
import AdminDashboard from '@/components/submissions/AdminDashboard';
import ApiStatus from '@/components/submissions/ApiStatus';

export default function SubmissionsPage() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);

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

  // Restore existing session on mount
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setAuthState('unauthenticated');
      return;
    }

    sb.auth.getSession().then(({ data }) => {
      handleUser(data.session?.user ?? null);
    });

    // Keep auth state in sync across tabs
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [handleUser]);

  const handleLogout = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    setUser(null);
    setAuthState('unauthenticated');
  };

  return (
    <section className="section">
      <div className="container">
        <h2>Homework Submissions</h2>
        <p className="section-intro">
          Authenticate below to view your submissions and grades for the course programming assignments.
        </p>

        <div className="course-details-grid submissions-grid">
          {/* Left column — auth / dashboard */}
          <div className="detail-card">
            {authState === 'loading' && (
              <p className="prereq-note">Loading…</p>
            )}
            {authState === 'unauthenticated' && (
              <AuthPanel onAuth={handleUser} />
            )}
            {authState === 'student' && user && (
              <StudentDashboard user={user} onLogout={handleLogout} />
            )}
            {authState === 'admin' && user && (
              <AdminDashboard user={user} onLogout={handleLogout} />
            )}
          </div>

          {/* Right column — API status */}
          <div className="detail-card">
            <ApiStatus />
          </div>
        </div>
      </div>
    </section>
  );
}
