import { sanitizeMultiline } from '@/utils/sanitizeLine'

import { isFeedbackTokenTimely } from './feedbackToken'

/**
 * Validate and normalise a visitor's feedback (docs/public-redesign/feedback.md), the way
 * `validateInquiry` does for inquiries: pure, so every rule is testable without storing or
 * sending anything.
 *
 * Bots are dropped silently (`drop`: answer as if it worked, store nothing, send nothing), never
 * told which check caught them: the honeypot, the timing token, more than two links. A person's
 * mistake (empty, too short, too long) gets one generic 400.
 */

/** Where a message was sent from: the fixed values the UI sends. */
export const FEEDBACK_SOURCES = ['home', 'room'] as const
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

export const FEEDBACK_MIN_LENGTH = 3
export const FEEDBACK_MAX_LENGTH = 2000
export const FEEDBACK_MAX_LINKS = 2

export type FeedbackInput = {
  message: string
  source: FeedbackSource
  /** Only from a room: the id the page sent, still to be checked against the database. */
  exhibitionId: string | null
}

export type FeedbackValidation =
  | { ok: true; value: FeedbackInput }
  /** Answer as if it succeeded; store and send nothing. */
  | { ok: false; drop: true }
  | { ok: false; drop?: false; status: 400; error: string }

const INVALID = { ok: false, status: 400, error: 'Invalid request.' } as const

const LINK = /https?:\/\/|www\./gi

/** An exhibition id's shape (a uuid, or any short id): anything else is dropped, not looked up. */
const ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/

export function validateFeedback(
  body: unknown,
  { now, secret }: { now: number; secret: string | null },
): FeedbackValidation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return INVALID
  const fields = body as Record<string, unknown>

  // 1. Honeypot: an invisible, tab-skipped field no person fills.
  if (typeof fields.website === 'string' && fields.website.trim() !== '') {
    return { ok: false, drop: true }
  }
  // 2. Timing: a token this server signed when the window opened, 3 s to a day old.
  if (!secret || !isFeedbackTokenTimely(fields.token, now, secret)) {
    return { ok: false, drop: true }
  }

  if (typeof fields.message !== 'string') return INVALID
  // Sanitized BEFORE measuring, so padding with control characters can't slip past.
  const message = sanitizeMultiline(fields.message).trim()
  if (message.length < FEEDBACK_MIN_LENGTH || message.length > FEEDBACK_MAX_LENGTH) {
    return INVALID
  }

  if (
    typeof fields.source !== 'string' ||
    !(FEEDBACK_SOURCES as readonly string[]).includes(fields.source)
  ) {
    return INVALID
  }
  const source = fields.source as FeedbackSource

  // 3. Link spam: more than two links.
  if ((message.match(LINK) ?? []).length > FEEDBACK_MAX_LINKS) return { ok: false, drop: true }

  const exhibitionId =
    source === 'room' &&
    typeof fields.exhibitionId === 'string' &&
    ID_SHAPE.test(fields.exhibitionId)
      ? fields.exhibitionId
      : null

  return { ok: true, value: { message, source, exhibitionId } }
}
