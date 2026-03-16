'use client';

import { useState, useEffect, useRef } from 'react';

const DEFAULT_API_URL = 'https://nlp-course-api.onrender.com/';
const CHECK_TIMEOUT_MS = 15000;
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

type Status = 'checking' | 'running' | 'error';

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [statusText, setStatusText] = useState('Checking system status…');
  const [detail, setDetail] = useState('');
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const checkInProgress = useRef(false);
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '';
  const apiUrl = (typeof raw === 'string' ? raw.replace(/\/+$/, '') : '') || DEFAULT_API_URL;

  async function check() {
    if (!apiUrl) {
      setStatus('error');
      setStatusText('API URL not configured');
      setDetail('');
      setResponseTimeMs(null);
      return;
    }
    if (checkInProgress.current) return;
    checkInProgress.current = true;
    setStatus('checking');
    setStatusText('Checking system status…');
    setDetail('');
    setResponseTimeMs(null);
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(apiUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      setResponseTimeMs(elapsed);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = String(data?.status ?? '').toLowerCase();
      if (s === 'running') {
        setStatus('running');
        setStatusText('Service is running ✅');
        setDetail('You will soon be able to upload homework through this page.');
      } else {
        setStatus('error');
        setStatusText(`Service responded — status: ${data?.status ?? 'unknown'}`);
        setDetail('If this persists, please contact the instructor.');
      }
    } catch (err: unknown) {
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      setResponseTimeMs(elapsed);
      setStatus('error');
      setStatusText('Cannot reach submission service ❌');
      setDetail(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      checkInProgress.current = false;
    }
  }

  useEffect(() => {
    check();
    const interval = setInterval(check, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const backendLabel =
    status === 'checking'
      ? 'Checking…'
      : status === 'running'
        ? `Up${responseTimeMs != null ? ` (${formatDuration(responseTimeMs)})` : ''}`
        : apiUrl
          ? `Down${responseTimeMs != null ? ` (${formatDuration(responseTimeMs)})` : ''}`
          : 'Not configured';

  return (
    <>
      <h3>API and storage</h3>
      <div className="admin-backend-status-row">
        <span className="signup-toggle-label">
          Backend:
          <span
            className={`admin-backend-dot admin-backend-dot--${status === 'checking' ? 'checking' : status === 'running' ? 'up' : 'down'}`}
            title={status === 'running' ? 'Grading service is up' : status === 'error' ? 'Unreachable (may be sleeping on free tier)' : 'Checking…'}
            aria-hidden
          />
          <span className="admin-backend-label">{backendLabel}</span>
        </span>
        <button
          className="btn-secondary btn-small"
          type="button"
          onClick={check}
          disabled={status === 'checking'}
          title="Check again"
        >
          {status === 'checking' ? '…' : 'Check'}
        </button>
      </div>
      <p className="api-status-text">{statusText}</p>
      {detail && <p className="api-message">{detail}</p>}
    </>
  );
}
