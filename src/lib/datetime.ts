/**
 * Optional fixed IANA timezone for displaying timestamps (deadlines, submissions).
 * If unset, the browser's local timezone is used (Supabase still stores UTC).
 *
 * Static export: value must be present at **build** time (e.g. GitHub Actions `env` on `npm run build`),
 * not only as a repo secret with no workflow wiring.
 */
const DISPLAY_TIMEZONE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE
    ? process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE
    : undefined;

export function formatCourseDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
    ...(DISPLAY_TIMEZONE ? { timeZone: DISPLAY_TIMEZONE } : {}),
  });
}
