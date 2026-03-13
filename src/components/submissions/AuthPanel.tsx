'use client';

import { useState, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

interface AuthPanelProps {
  onAuth: (user: User | null) => void;
}

type View = 'login' | 'forgot';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function AuthPanel({ onAuth }: AuthPanelProps) {
  const [view, setView] = useState<View>('login');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Forgot-password field
  const [resetEmail, setResetEmail] = useState('');

  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  function showMsg(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return showMsg('Auth service unavailable.', true);
    setBusy(true);
    showMsg('Logging in…');
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      showMsg('Logged in successfully.');
      onAuth(data.user);
    } catch (err: unknown) {
      showMsg('Login failed: ' + (err instanceof Error ? err.message : 'Unknown error'), true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return showMsg('Auth service unavailable.', true);
    setBusy(true);
    showMsg('Creating account…');
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}${BASE_PATH}/submissions`
          : undefined;
      const { error } = await sb.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          emailRedirectTo: redirectTo,
          // Name is passed as metadata → handle_new_user() writes it to profiles
          data: { name: signupName.trim() },
        },
      });
      if (error) throw error;
      showMsg('Account created. Check your email to confirm before logging in.');
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
    } catch (err: unknown) {
      showMsg('Sign-up failed: ' + (err instanceof Error ? err.message : 'Unknown error'), true);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return showMsg('Auth service unavailable.', true);
    setBusy(true);
    showMsg('Sending reset link…');
    // Redirect back to this page; the recovery token arrives in the URL hash
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${BASE_PATH}/submissions`
        : undefined;
    try {
      const { error } = await sb.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo,
      });
      if (error) throw error;
      showMsg('Reset link sent — check your email. You can close this form.');
      setResetEmail('');
    } catch (err: unknown) {
      showMsg('Could not send reset link: ' + (err instanceof Error ? err.message : 'Unknown error'), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3>Student Login</h3>
      <p className="prereq-note" style={{ marginBottom: '1rem' }}>
        Use your course account to log in. New students can sign up below.
      </p>

      {/* ── Login form ── */}
      <form className="auth-form" onSubmit={handleLogin}>
        <div className="auth-field">
          <input
            type="email"
            placeholder="Email"
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <input
            type="password"
            placeholder="Password"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-primary btn-small" disabled={busy}>
            Log in
          </button>
          <button
            type="button"
            className="read-more-btn"
            onClick={() => { setView(view === 'forgot' ? 'login' : 'forgot'); showMsg(''); }}
          >
            {view === 'forgot' ? '← Back to login' : 'Forgot password?'}
          </button>
        </div>
      </form>

      {/* ── Forgot-password panel ── */}
      {view === 'forgot' && (
        <>
          <h4 className="auth-section-title">Reset password</h4>
          <p className="prereq-note" style={{ marginBottom: '0.75rem' }}>
            Enter your account email and we&apos;ll send you a link to set a new password.
          </p>
          <form className="auth-form" onSubmit={handleForgotPassword}>
            <div className="auth-field">
              <input
                type="email"
                placeholder="Email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <button type="submit" className="btn-primary btn-small" disabled={busy}>
              Send reset link
            </button>
          </form>
        </>
      )}

      {/* ── Sign-up form ── */}
      {view === 'login' && (
        <>
          <h4 className="auth-section-title">Create an account</h4>
          <form className="auth-form" onSubmit={handleSignup}>
            <div className="auth-field">
              <input
                type="text"
                placeholder="Full name"
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="auth-field">
              <input
                type="email"
                placeholder="Email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="auth-field">
              <input
                type="password"
                placeholder="Password"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <button type="submit" className="btn-primary btn-small" disabled={busy}>
              Sign up
            </button>
          </form>
        </>
      )}

      {message && (
        <p className={`auth-message${isError ? ' error' : ''}`}>{message}</p>
      )}
    </div>
  );
}
