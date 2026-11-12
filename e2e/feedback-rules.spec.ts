import { test, expect } from '@playwright/test'

import { renderFeedbackAdminNotificationEmail } from '@/lib/emails/feedbackAdminNotification'
import {
  FEEDBACK_MAX_AGE_MS,
  isFeedbackTokenTimely,
  signFeedbackToken,
} from '@/lib/feedback/feedbackToken'
import { validateFeedback } from '@/lib/feedback/validateFeedback'

/**
 * Visitor feedback's rules (docs/public-redesign/feedback.md), Node only: no server, no database,
 * no mail. The route's own checks are in visitor-feedback.spec.ts.
 */

const SECRET = 'feedback-rules-test-secret'
const NOW = 1_800_000_000_000
const token = (ageMs = 10_000) => signFeedbackToken(NOW - ageMs, SECRET)
const check = (body: unknown) => validateFeedback(body, { now: NOW, secret: SECRET })
const valid = (extra: Record<string, unknown> = {}) => ({
  message: 'Lovely rooms.',
  source: 'home',
  token: token(),
  ...extra,
})

test.describe('timing token', () => {
  test('accepts its own token between 3 seconds and a day old', () => {
    expect(isFeedbackTokenTimely(token(3_000), NOW, SECRET)).toBe(true)
    expect(isFeedbackTokenTimely(token(FEEDBACK_MAX_AGE_MS), NOW, SECRET)).toBe(true)
  })

  test('refuses a token too young, too old, from the future, forged or malformed', () => {
    expect(isFeedbackTokenTimely(token(2_999), NOW, SECRET)).toBe(false)
    expect(isFeedbackTokenTimely(token(FEEDBACK_MAX_AGE_MS + 1), NOW, SECRET)).toBe(false)
    expect(isFeedbackTokenTimely(token(-60_000), NOW, SECRET)).toBe(false)
    expect(isFeedbackTokenTimely(signFeedbackToken(NOW - 10_000, 'other'), NOW, SECRET)).toBe(false)
    const [issued] = token().split('.')
    expect(
      isFeedbackTokenTimely(`${Number(issued) - 1000}.${token().split('.')[1]}`, NOW, SECRET),
    ).toBe(false)
    for (const bad of [undefined, null, 42, '', 'abc', `${NOW}.zz`, `${NOW}`]) {
      expect(isFeedbackTokenTimely(bad, NOW, SECRET)).toBe(false)
    }
  })
})

test.describe('validateFeedback', () => {
  test('accepts a message, sanitized and trimmed', () => {
    const result = check(valid({ message: '  Lovely​ rooms.\r\nThank you\u0007  ' }))
    expect(result).toEqual({
      ok: true,
      value: { message: 'Lovely rooms.\nThank you', source: 'home', exhibitionId: null },
    })
  })

  test('drops silently: honeypot, missing / young / forged token, no secret, more than two links', () => {
    for (const body of [
      valid({ website: 'https://spam.example' }),
      valid({ token: undefined }),
      valid({ token: token(1_000) }),
      valid({ token: signFeedbackToken(NOW - 10_000, 'forged') }),
      valid({ message: 'see http://a.example www.b.example https://c.example' }),
    ]) {
      expect(check(body)).toEqual({ ok: false, drop: true })
    }
    expect(validateFeedback(valid(), { now: NOW, secret: null })).toEqual({ ok: false, drop: true })
    // Two links are fine.
    expect(check(valid({ message: 'http://a.example and www.b.example' })).ok).toBe(true)
  })

  test('refuses with one generic error: not an object, no message, too short, too long, bad source', () => {
    for (const body of [
      null,
      'text',
      [],
      valid({ message: 42 }),
      valid({ message: ' a​ ' }),
      valid({ message: 'x'.repeat(2001) }),
      valid({ source: 'admin' }),
      valid({ source: undefined }),
    ]) {
      expect(check(body)).toEqual({ ok: false, status: 400, error: 'Invalid request.' })
    }
    // Measured after sanitizing: padding does not count.
    expect(check(valid({ message: `${'x'.repeat(2000)}​​` })).ok).toBe(true)
  })

  test('keeps an exhibition id only from a room, and only of an id shape', () => {
    const room = (exhibitionId: unknown) => check(valid({ source: 'room', exhibitionId }))
    expect(room('3f2a9c1e-0b5d-4c7e-9a1f-2b3c4d5e6f70')).toMatchObject({
      ok: true,
      value: { source: 'room', exhibitionId: '3f2a9c1e-0b5d-4c7e-9a1f-2b3c4d5e6f70' },
    })
    expect(room("1' OR '1'='1")).toMatchObject({ ok: true, value: { exhibitionId: null } })
    expect(room(42)).toMatchObject({ ok: true, value: { exhibitionId: null } })
    expect(check(valid({ exhibitionId: 'abc' }))).toMatchObject({
      ok: true,
      value: { source: 'home', exhibitionId: null },
    })
  })
})

test('the email: fixed subject, escaped message, origin and Madrid time, plain text too', () => {
  const email = renderFeedbackAdminNotificationEmail({
    message: '<script>alert(1)</script>\nSecond line',
    from: 'Home page',
    sentAt: new Date('2026-11-12T22:30:00Z'),
  })
  expect(email.subject).toBe('New visitor feedback')
  expect(email.html).not.toContain('<script>')
  expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>Second line')
  expect(email.html).toContain('Home page')
  expect(email.html).toContain('12 November 2026')
  expect(email.html).toContain('23:30')
  expect(email.text).toContain('<script>alert(1)</script>\nSecond line')
  expect(email.text).toContain('From: Home page')
})
