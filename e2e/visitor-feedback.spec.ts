import { randomInt } from 'node:crypto'

import { test, expect, type APIRequestContext } from '@playwright/test'

import { feedbackSecret, signFeedbackToken } from '@/lib/feedback/feedbackToken'
import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'

/**
 * Visitor feedback (docs/public-redesign/feedback.md): the route's checks against the dev server
 * (SKIP_EMAILS: no mail leaves) and the homepage band → window → thank-you. Every request carries
 * its own made-up client address, so the per-address limits never carry over between runs. Rows
 * this spec stores carry a marker and are deleted at the end. The rules themselves are in
 * feedback-rules.spec.ts.
 */

const MARKER = `e2e-feedback-${Date.now()}`
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001'
const fakeIp = () => `198.51.100.${randomInt(1, 255)}.${randomInt(1, 1_000_000)}`

/** A token the server signed 5 s ago (the runner shares its secret via .env.local). */
const oldToken = () => {
  const secret = feedbackSecret()
  if (!secret) throw new Error('AUTH_SECRET missing from the test env')
  return signFeedbackToken(Date.now() - 5_000, secret)
}

const post = (
  request: APIRequestContext,
  ip: string,
  data: unknown,
  headers: Record<string, string> = {},
) =>
  request.post('/api/feedback', {
    headers: { origin: BASE, 'content-type': 'application/json', 'x-real-ip': ip, ...headers },
    data: typeof data === 'string' ? data : JSON.stringify(data),
  })

const stored = () => prisma.feedback.findMany({ where: { message: { contains: MARKER } } })

test.afterAll(async () => {
  await prisma.feedback.deleteMany({ where: { message: { contains: MARKER } } })
})

test.describe.configure({ mode: 'serial' })

test('refuses another site, another content type and an oversized body, before reading it', async ({
  request,
}) => {
  const body = { message: `${MARKER} hello`, source: 'home', token: oldToken() }
  expect((await post(request, fakeIp(), body, { origin: 'https://evil.example' })).status()).toBe(
    403,
  )
  expect((await post(request, fakeIp(), body, { 'content-type': 'text/plain' })).status()).toBe(415)
  const big = { ...body, message: `${MARKER} ${'x'.repeat(9_000)}` }
  expect((await post(request, fakeIp(), big)).status()).toBe(413)
  expect(await stored()).toHaveLength(0)
})

test('answers bots like a success and stores nothing', async ({ request }) => {
  const fresh = await request.get('/api/feedback')
  expect(fresh.headers()['cache-control']).toContain('no-store')
  const { token: youngToken } = await fresh.json()
  for (const body of [
    { message: `${MARKER} honeypot`, source: 'home', token: oldToken(), website: 'x' },
    { message: `${MARKER} too soon`, source: 'home', token: youngToken },
    { message: `${MARKER} no token`, source: 'home' },
    {
      message: `${MARKER} http://a.example www.b.example https://c.example`,
      source: 'home',
      token: oldToken(),
    },
  ]) {
    const res = await post(request, fakeIp(), body)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  }
  expect(await stored()).toHaveLength(0)
})

test('a short message gets the generic error, never echoed', async ({ request }) => {
  const res = await post(request, fakeIp(), { message: ' a ', source: 'home', token: oldToken() })
  expect(res.status()).toBe(400)
  expect(await res.json()).toEqual({ error: 'Invalid request.' })
})

test('stores a room message once, drops the duplicate, and an unknown exhibition becomes none', async ({
  request,
}) => {
  const ip = fakeIp()
  const body = {
    message: `${MARKER} from a room`,
    source: 'room',
    exhibitionId: '00000000-0000-4000-8000-000000000000',
    token: oldToken(),
  }
  expect((await post(request, ip, body)).status()).toBe(200)
  expect((await post(request, ip, { ...body, token: oldToken() })).status()).toBe(200)
  const rows = await stored()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ source: 'room', exhibitionId: null })
})

test('over 3 a minute from one address: 429 with words the window shows', async ({ request }) => {
  const ip = fakeIp()
  // Honeypot hits: they count against the address and store nothing.
  const bot = { message: `${MARKER} limit`, source: 'home', token: oldToken(), website: 'x' }
  for (let i = 0; i < 3; i++) expect((await post(request, ip, bot)).status()).toBe(200)
  const res = await post(request, ip, bot)
  expect(res.status()).toBe(429)
  expect(await res.json()).toEqual({ error: 'Too many messages. Please try again later.' })
})

test('home: the band opens the window, and a message ends on the thank-you', async ({ page }) => {
  await seedCookieConsent(page)
  await page.setExtraHTTPHeaders({ 'x-real-ip': fakeIp() })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'We’d love to hear from you' })).toBeVisible()
  await page.getByRole('button', { name: 'Give feedback' }).click()

  const dialog = page.getByRole('dialog', { name: 'Share your thoughts' })
  await expect(dialog).toBeVisible()
  const send = dialog.getByRole('button', { name: 'Send feedback' })
  await expect(send).toBeDisabled()
  await dialog
    .getByRole('textbox', { name: 'Your feedback' })
    .fill(`${MARKER} the rooms are lovely`)
  // The server drops a message sent within 3 s of opening (a bot's speed).
  await page.waitForTimeout(3_200)
  await send.click()

  const thanks = page.getByRole('dialog', { name: 'Thank you' })
  await expect(thanks.getByRole('status')).toContainText('Your note goes straight to the gallery.')
  await expect
    .poll(() => prisma.feedback.count({ where: { message: { contains: `${MARKER} the rooms` } } }))
    .toBe(1)
  await thanks.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
