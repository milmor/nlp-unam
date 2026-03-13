'use client';

import { useState, FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

interface AuthPanelProps {
  onAuth: (user: User | null) => void;
}

export default function AuthPanel({ onAuth }: AuthPanelProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
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
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showMsg('Login failed: ' + msg, true);
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
      const { error } = await sb.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
      });
      if (error) throw error;
      showMsg('Account created. Check your email to confirm before logging in.');
      setSignupEmail('');
      setSignupPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showMsg('Sign-up failed: ' + msg, true);
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
        <button type="submit" className="btn-primary btn-small" disabled={busy}>
          Log in
        </button>
      </form>

      <h4 className="auth-section-title">Create an account</h4>
      <form className="auth-form" onSubmit={handleSignup}>
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

      {message && (
        <p className={`auth-message${isError ? ' error' : ''}`}>{message}</p>
      )}
    </div>
  );
}
