'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

const SUPABASE_PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  : '';

const DB_LIMIT_MB   = 500;
const STOR_LIMIT_MB = 1024;

function fmt(bytes: number) {
  if (bytes < 1024)           return `${bytes} B`;
  if (bytes < 1024 ** 2)      return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)      return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function Bar({ usedMB, limitMB }: { usedMB: number; limitMB: number }) {
  const pct = Math.min((usedMB / limitMB) * 100, 100);
  const tone = pct > 85 ? 'high' : pct > 60 ? 'mid' : 'ok';
  return (
    <div className="usage-bar-track">
      <div className={`usage-bar-fill usage-bar-fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function UsageStats() {
  const [dbBytes,        setDbBytes]        = useState<number | null>(null);
  const [storBytes,      setStorBytes]      = useState<number | null>(null);
  const [students,       setStudents]       = useState<number | null>(null);
  const [submissions,    setSubmissions]    = useState<number | null>(null);
  const [error,          setError]          = useState('');

  useEffect(() => {
    async function load() {
      const sb = getSupabase();
      if (!sb) return setError('Auth service unavailable.');
      try {
        const [dbRes, storRes, studentsRes, subsRes] = await Promise.all([
          sb.rpc('get_db_size'),
          sb.from('storage_usage').select('total_bytes').single(),
          sb.from('profiles').select('id', { count: 'exact', head: true }),
          sb.from('submissions').select('id', { count: 'exact', head: true }),
        ]);

        if (dbRes.error) throw dbRes.error;
        setDbBytes(Number(dbRes.data));

        // storage_usage is a view we create below; fall back to querying objects
        if (!storRes.error && storRes.data) {
          setStorBytes(Number(storRes.data.total_bytes));
        } else {
          // Fallback: sum metadata->>'size' from storage.objects
          const { data: objs, error: objErr } = await sb
            .from('objects')
            .select('metadata')
            .eq('bucket_id', 'student-notebooks');
          if (!objErr && objs) {
            const total = objs.reduce((acc, o) => acc + Number(o.metadata?.size ?? 0), 0);
            setStorBytes(total);
          }
        }

        setStudents(studentsRes.count ?? 0);
        setSubmissions(subsRes.count ?? 0);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load usage stats.');
      }
    }
    load();
  }, []);

  const dbMB   = dbBytes   != null ? dbBytes   / 1024 ** 2 : null;
  const storMB = storBytes != null ? storBytes / 1024 ** 2 : null;

  return (
    <div className="usage-stats">
      <h5 className="admin-section-title">Resource usage</h5>

      {error && <p className="prereq-note sub-note--error">{error}</p>}

      <div className="usage-grid">
        {/* Database */}
        <div className="usage-item">
          <div className="usage-item-header">
            <span className="usage-item-label">Database</span>
            <span className="usage-item-value">
              {dbMB != null ? `${dbMB.toFixed(2)} MB` : '…'} / {DB_LIMIT_MB} MB
            </span>
          </div>
          {dbMB != null && <Bar usedMB={dbMB} limitMB={DB_LIMIT_MB} />}
        </div>

        {/* Storage */}
        <div className="usage-item">
          <div className="usage-item-header">
            <span className="usage-item-label">Storage</span>
            <span className="usage-item-value">
              {storMB != null ? `${storMB.toFixed(2)} MB` : '…'} / {STOR_LIMIT_MB} MB
            </span>
          </div>
          {storMB != null && <Bar usedMB={storMB} limitMB={STOR_LIMIT_MB} />}
          {storBytes != null && (
            <span className="usage-item-sub">{fmt(storBytes)} of notebooks</span>
          )}
        </div>

        {/* Counts */}
        <div className="usage-item">
          <div className="usage-item-header">
            <span className="usage-item-label">Students</span>
            <span className="usage-item-value">{students ?? '…'}</span>
          </div>
        </div>

        <div className="usage-item">
          <div className="usage-item-header">
            <span className="usage-item-label">Submissions</span>
            <span className="usage-item-value">{submissions ?? '…'}</span>
          </div>
        </div>
      </div>

      {/* Bandwidth — not available via client API */}
      <p className="usage-bandwidth-note">
        Bandwidth usage is only visible in the{' '}
        <a
          href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/reports`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Supabase dashboard ↗
        </a>
        {' '}(free plan: 5 GB/month).
      </p>
    </div>
  );
}
