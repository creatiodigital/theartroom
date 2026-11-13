import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { sendFeedbackAdminNotificationEmail } from '@/lib/emails/feedbackAdminNotification'
import { feedbackSecret, signFeedbackToken } from '@/lib/feedback/feedbackToken'
import { validateFeedback } from '@/lib/feedback/validateFeedback'
import { getClientIp } from '@/lib/getClientIp'
import prisma from '@/lib/prisma'
import { rateLimit } from '@/lib/rateLimit'

/**
 * Visitor feedback (docs/public-redesign/feedback.md): one text box, stored and emailed to the
 * gallery. Public, no sign-in, built like /api/inquire with its safeguards, and stricter:
 *
 * - same origin only (403), JSON only (415), 8 KB at most (413), before any parsing;
 * - bots dropped silently, answered exactly like a success with nothing stored or sent: the
 *   honeypot, the signed timing token (GET below), more than two links, the same text again from
 *   the same address within 10 minutes;
 * - per address 3 a minute and 10 a day; a site-wide daily cap spent only by a message about to be
 *   stored and emailed (as the inquiry route explains); over a limit, 429 with words the window
 *   shows;
 * - nothing personal stored (no IP, no user agent); the message never in a log, an error or a
 *   header; generic errors only.
 *
 * If the email fails, the message stays stored, the failure is logged without the text, and the
 * visitor still sees the thank-you.
 */

const BODY_LIMIT = 8 * 1024
const DAILY_CAP = Number(process.env.FEEDBACK_DAILY_CAP ?? 50)
const MINUTE = 60
const DAY = 86_400
const DUPLICATE_WINDOW = 600

const json = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const invalid = (status: number) => json({ error: 'Invalid request.' }, status)
const tooMany = () => json({ error: 'Too many messages. Please try again later.' }, 429)
const accepted = () => json({ success: true })

/** The window's timing token, asked for when it opens (no cookies). */
export async function GET() {
  const secret = feedbackSecret()
  if (!secret) {
    console.error('Feedback: no server secret, so no token can be issued.')
    return json({ error: 'Unavailable.' }, 503)
  }
  return json({ token: signFeedbackToken(Date.now(), secret) })
}

/** The request's own host: the page that posts must be on it (this site, staging or dev). */
const isSameOrigin = (request: NextRequest) => {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(request.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
      return invalid(415)
    }
    if (!isSameOrigin(request)) return invalid(403)
    if (Number(request.headers.get('content-length') ?? 0) > BODY_LIMIT) return invalid(413)

    // Durable limiter keyed on the trusted client IP (never stored with the message).
    const ip = getClientIp(request)
    const perMinute = await rateLimit({
      name: 'feedback',
      key: ip,
      limit: 3,
      windowSeconds: MINUTE,
    })
    if (!perMinute.success) return tooMany()
    const perDay = await rateLimit({ name: 'feedback-day', key: ip, limit: 10, windowSeconds: DAY })
    if (!perDay.success) return tooMany()

    const raw = await request.text()
    if (raw.length > BODY_LIMIT) return invalid(413)
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return invalid(400)
    }

    const result = validateFeedback(body, { now: Date.now(), secret: feedbackSecret() })
    if (!result.ok) return result.drop ? accepted() : invalid(result.status)
    const { message, source } = result.value

    // The same words again from the same address within 10 minutes: dropped. Keyed on a hash, so
    // neither the address nor the text sits in the limiter's table.
    const fingerprint = createHash('sha256').update(`${ip}\n${message}`).digest('hex').slice(0, 40)
    const duplicate = await rateLimit({
      name: 'feedback-dup',
      key: fingerprint,
      limit: 1,
      windowSeconds: DUPLICATE_WINDOW,
    })
    if (!duplicate.success) return accepted()

    // From a room: the exhibition the page named, if it is a published one; else none (the
    // message is kept).
    const exhibition = result.value.exhibitionId
      ? await prisma.exhibition.findFirst({
          where: { id: result.value.exhibitionId, published: true },
          select: { id: true, mainTitle: true },
        })
      : null

    const daily = await rateLimit({
      name: 'feedback-daily',
      key: 'global',
      limit: DAILY_CAP,
      windowSeconds: DAY,
    })
    if (!daily.success) return tooMany()

    const stored = await prisma.feedback.create({
      data: { message, source, exhibitionId: exhibition?.id ?? null },
      select: { createdAt: true },
    })

    const sent = await sendFeedbackAdminNotificationEmail({
      message,
      from: source === 'home' ? 'Home page' : exhibition ? exhibition.mainTitle : 'A 3D room',
      sentAt: stored.createdAt,
    })
    if (!sent.ok) console.error('Feedback stored; the email to the gallery failed:', sent.error)

    return accepted()
  } catch (error) {
    // The error's kind only: a database error's message can quote the query's data, i.e. the text.
    const code = (error as { code?: unknown })?.code
    console.error(
      'Error processing feedback:',
      error instanceof Error ? error.name : 'unknown',
      typeof code === 'string' ? code : '',
    )
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
}
