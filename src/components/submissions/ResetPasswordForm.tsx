'use client';

import { useState, FormEvent } from 'react';
import { getSupabase } from '@/lib/supabase';

interface Props {
  onDone: () => void;
}

export default function ResetPasswordForm({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirm) {
      setMessage('Passwords do not match.');
      setIsError(true);
      return;
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      setIsError(true);
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      setMessage('Auth service unavailable.');
      setIsError(true);
      return;
    }

    setBusy(true);
    setMessage('Updating password…');
    setIsError(false);

    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setMessage('Password updated successfully. You can now log in.');
      setDone(true);
    } catch (err: unknown) {
      setMessage('Failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3>Set a new password</h3>
      <p className="prereq-note" style={{ marginBottom: '1rem' }}>
        Choose a new password for your account.
      </p>

      {!done ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={busy}
            />
          </div>
          <div className="auth-field">
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={6}
              disabled={busy}
            />
          </div>
          <button type="submit" className="btn-primary btn-small" disabled={busy}>
            Update password
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={onDone}
          style={{ marginTop: '0.75rem' }}
        >
          Go to login
        </button>
      )}

      {message && (
        <p className={`auth-message${isError ? ' error' : ''}`}>{message}</p>
      )}
    </div>
  );
}
