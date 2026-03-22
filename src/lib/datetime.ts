/** Display zone for deadlines & submissions (Supabase stores UTC). */
const DISPLAY_TIMEZONE = 'America/Mexico_City';

/**
 * Parse Supabase/Postgres timestamps. Naive strings (no Z / ±offset) are treated as UTC —
 * otherwise JS interprets them as local wall time and times look wrong in Mexico.
 */
export function parseCourseDate(iso: string): Date {
  let s = iso.trim().replace(/\s+/, 'T');
  const hasZone = /[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  if (!hasZone) s = s.endsWith('Z') ? s : `${s}Z`;
  return new Date(s);
}

export function formatCourseDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseCourseDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: DISPLAY_TIMEZONE,
  });
}
