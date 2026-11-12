import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The feedback window's timing token (docs/public-redesign/feedback.md "Bots", layer 2): when the
 * window opened, signed by the server so it can't be forged. A submit sooner than
 * `FEEDBACK_MIN_AGE_MS` after opening, or with a missing, invalid or day-old token, is dropped
 * silently. No cookies: the window asks for a token (GET /api/feedback) when it opens.
 *
 * Pure apart from node:crypto, so the rules are testable without a server.
 */

export const FEEDBACK_MIN_AGE_MS = 3_000
export const FEEDBACK_MAX_AGE_MS = 86_400_000

const sign = (issuedAt: number, secret: string) =>
  createHmac('sha256', secret).update(`feedback-window:${issuedAt}`).digest('hex')

/** `{issuedAt}.{signature}`. */
export function signFeedbackToken(issuedAt: number, secret: string): string {
  return `${issuedAt}.${sign(issuedAt, secret)}`
}

/**
 * True only for a token this server signed, between 3 seconds and a day old at `now`. Anything
 * else (not a string, malformed, forged, from the future, too young, too old) is false.
 */
export function isFeedbackTokenTimely(token: unknown, now: number, secret: string): boolean {
  if (typeof token !== 'string' || token.length > 100) return false
  const match = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(token)
  if (!match) return false
  const issuedAt = Number(match[1])
  const expected = Buffer.from(sign(issuedAt, secret), 'hex')
  const given = Buffer.from(match[2], 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false
  const age = now - issuedAt
  return age >= FEEDBACK_MIN_AGE_MS && age <= FEEDBACK_MAX_AGE_MS
}

/**
 * The server secret the tokens are signed with: Auth.js's own (set in every environment, or no
 * one could sign in). Null if it is missing: then no token is issued and every message is dropped,
 * which the route logs.
 */
export function feedbackSecret(): string | null {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null
}
