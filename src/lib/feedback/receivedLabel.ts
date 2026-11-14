/**
 * When a feedback arrived, as the admin list shows it (docs/admin-redesign/feedback-list.md), in
 * the gallery's time (Europe/Madrid): "Today, 09:42", "Yesterday, 21:10", else "12 Nov, 18:30",
 * with the year when it isn't this year ("12 Nov 2025, 18:30").
 */
const ZONE = 'Europe/Madrid'

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const time = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)

const year = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, year: 'numeric' }).format(date)

/** The calendar day before a "YYYY-MM-DD" day (not 24 hours back: a clock change day is 23 or 25). */
const dayBefore = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

export const receivedLabel = (date: Date, now: Date = new Date()) => {
  const today = dayKey(now)
  if (dayKey(date) === today) return `Today, ${time(date)}`
  if (dayKey(date) === dayBefore(today)) return `Yesterday, ${time(date)}`
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'short',
    ...(year(date) !== year(now) && { year: 'numeric' }),
  }).format(date)
  return `${day}, ${time(date)}`
}
