import { OTHER_SEGMENT } from '@/lib/analytics/reportShape'

/** A segment's colour: its position in the report's segment order, "Other" gray. */
export function segmentColor(segment: string, segments: string[]): string {
  if (segment === OTHER_SEGMENT) return 'var(--admin-series-other)'
  const slot = segments.filter((s) => s !== OTHER_SEGMENT).indexOf(segment)
  return slot >= 0 && slot < 3 ? `var(--admin-series-${slot + 1})` : 'var(--admin-series-other)'
}

const numberFormat = new Intl.NumberFormat('en-GB')
export const formatNumber = (n: number) => numberFormat.format(Math.round(n))

/** 0.4567 → "46%". */
export const formatPercent = (share: number) => `${Math.round(share * 100)}%`

/** "2026-11-18" → "18 Nov" (the date is Madrid's calendar day, read as such). */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** 8240 → "8.2 s"; 72_000 → "1 min 12 s". */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}

/** The change against the period before, as words the owner reads at a glance. */
export function formatChange(current: number, previous: number, periodLabel: string): string {
  if (previous === 0 && current === 0) return `None in the ${periodLabel} before either`
  if (previous === 0) return `None in the ${periodLabel} before`
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.005) return `Same as the ${periodLabel} before`
  return `${change > 0 ? '↑' : '↓'} ${formatPercent(Math.abs(change))} vs the ${periodLabel} before`
}

const STEP_LABELS: Record<string, string> = {
  address: 'Address',
  review: 'Review',
  payment: 'Payment',
  payment_return: 'Back from the bank',
  confirmation: 'Confirmation',
}

const REASON_LABELS: Record<string, string> = {
  invalid_fields: 'Fields not valid',
  item_unavailable: 'A print no longer available',
  payment_unavailable: 'Payment could not start',
  verify_failed: 'Payment not verified',
  order_not_finalized: 'Order not finalized',
}

/** A checkout error as a line: "Payment · card declined". */
export function checkoutErrorLabel(step: string, reason: string): string {
  const where = STEP_LABELS[step] ?? step
  const why = REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
  return `${where} · ${why}`
}

const ROOM_ERROR_LABELS: Record<string, string> = {
  webgl_unavailable: '3D not supported by the browser',
  scene_crash: 'The 3D scene crashed',
  load_error: 'The exhibition failed to load',
  not_found: 'Exhibition not found',
  details_fetch_failed: "A work's details failed to load",
}

export function roomErrorLabel(reason: string): string {
  if (reason.startsWith('details_http_')) return `A work's details failed (${reason.slice(13)})`
  return ROOM_ERROR_LABELS[reason] ?? reason.replace(/_/g, ' ')
}

/** "/" → "Home"; other paths as they are. */
export const pageLabel = (path: string) => (path === '/' ? 'Home' : path)
