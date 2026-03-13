'use client';

import { useState, useEffect } from 'react';

const API_URL = 'https://nlp-course-api.onrender.com/';

type Status = 'checking' | 'running' | 'error';

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [statusText, setStatusText] = useState('Checking system status…');
  const [detail, setDetail] = useState('');

  async function check() {
    setStatus('checking');
    setStatusText('Checking system status…');
    setDetail('');
    try {
      const res = await fetch(API_URL, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const s = String(data?.status ?? '').toLowerCase();
      if (s === 'running') {
        setStatus('running');
        setStatusText('API is running ✅');
        setDetail('You will soon be able to upload homework through this page.');
      } else {
        setStatus('error');
        setStatusText(`API responded — status: ${data?.status ?? 'unknown'}`);
        setDetail('If this persists, please contact the instructor.');
      }
    } catch (err: unknown) {
      setStatus('error');
      setStatusText('Cannot reach submission API ❌');
      setDetail(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  useEffect(() => { check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h3>System status</h3>
      <p className="api-status-text">{statusText}</p>
      <button
        className="btn-primary btn-small"
        type="button"
        onClick={check}
        disabled={status === 'checking'}
      >
        {status === 'checking' ? 'Checking…' : 'Check again'}
      </button>
      {detail && <p className="api-message">{detail}</p>}
    </>
  );
}
