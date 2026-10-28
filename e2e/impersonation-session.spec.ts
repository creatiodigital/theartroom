import { test, expect, type Page, type BrowserContext } from '@playwright/test'

import prisma from '@/lib/prisma'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Where an impersonation lives, and what ends it.
 *
 * It used to ride inside the login cookie (the 30-day NextAuth JWT). Two bugs
 * came from that, both seen by the owner:
 *
 *   - Stop Impersonating was silently undone. The proxy re-issues the login
 *     cookie on every /admin and /dashboard request, re-encoding whatever token
 *     THAT request carried. Stop navigated without waiting for the session
 *     change, so the page request left with the impersonating token and landed
 *     ~10 ms after the stop — writing the impersonation back. The browser
 *     believed it had stopped; the server did not. The next admin page showed
 *     "Viewing as X" over admin content.
 *   - Closing the browser did not end it: the login cookie is persistent.
 *
 * Only the races' OUTCOME is asserted here, never their timing: the specs
 * replay exactly what a stale response does (write back the login token) and
 * check what the server then believes.
 */

/** A user the admin is allowed to impersonate — not an admin, not a superAdmin. */
async function anArtist() {
  const user = await prisma.user.findFirstOrThrow({
    where: { userType: { notIn: ['admin', 'superAdmin'] } },
    select: { name: true, lastName: true },
    orderBy: { id: 'asc' },
  })
  return `${user.name} ${user.lastName}`.trim()
}

/** What the server believes about this browser right now. */
async function serverSession(context: BrowserContext) {
  const res = await context.request.get('/api/auth/session')
  return (await res.json()) as { user?: { id: string }; impersonating?: { name: string } } | null
}

/** Impersonate from /admin/users, the way the admin does it, and wait for the dashboard. */
async function impersonate(page: Page, fullName: string) {
  await page.goto('/admin/users')
  await page.waitForLoadState('networkidle')
  const row = page.locator('tbody tr', { hasText: fullName }).first()
  await row.locator('button[aria-label="Actions"]').click()
  await page.locator('button:has-text("Impersonate")').first().click()
  await page.waitForURL((url) => url.pathname === '/dashboard')
  await expect(page.getByText(`Viewing as ${fullName}`)).toBeVisible()
  await page.waitForLoadState('networkidle')
}

const loginToken = async (context: BrowserContext) =>
  (await context.cookies()).find((c) => c.name.endsWith('authjs.session-token'))

test('a stale login cookie written back after Stop cannot bring the impersonation back', async ({
  page,
  context,
}) => {
  const artist = await anArtist()
  await impersonate(page, artist)
  const tokenWhileImpersonating = await loginToken(context)
  expect(tokenWhileImpersonating).toBeDefined()

  await page.locator('button:has-text("Stop Impersonating")').first().click()
  await page.waitForURL((url) => url.pathname === '/admin/dashboard')
  await page.waitForLoadState('networkidle')

  // Exactly what the straggling page response did: re-set the login cookie to
  // the token it carried while the impersonation was on.
  await context.addCookies([tokenWhileImpersonating!])

  const session = await serverSession(context)
  expect(session?.user).toBeDefined()
  expect(session?.impersonating).toBeUndefined()
})

test('closing the browser ends the impersonation but keeps the admin logged in', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const artist = await anArtist()
  await impersonate(page, artist)
  expect((await serverSession(context))?.impersonating?.name).toBe(artist)

  // A browser restart keeps persistent cookies and drops session cookies
  // (those Playwright reports with expires -1).
  const { cookies } = await context.storageState()
  const reopened = await browser.newContext({
    baseURL,
    storageState: { cookies: cookies.filter((c) => c.expires !== -1), origins: [] },
  })
  try {
    const session = await serverSession(reopened)
    expect(session?.user).toBeDefined()
    expect(session?.impersonating).toBeUndefined()
  } finally {
    await reopened.close()
  }
})

test('going Back to an admin page ends the impersonation instead of mixing the two views', async ({
  page,
  context,
}) => {
  const artist = await anArtist()
  await impersonate(page, artist)

  await page.goBack()
  await page.waitForURL((url) => url.pathname === '/admin/users')
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(page.getByText('Viewing as')).toHaveCount(0)
  await expect.poll(async () => (await serverSession(context))?.impersonating).toBeUndefined()
})

test('an admin tab in the background does not cancel an impersonation; looking at it does', async ({
  page,
  context,
}) => {
  const artist = await anArtist()

  // The background tab: an admin page the owner left open. Its visibility is
  // driven by hand because every Playwright page reports itself visible.
  const adminTab = await context.newPage()
  await adminTab.addInitScript(() => {
    let state: DocumentVisibilityState = 'hidden'
    Object.defineProperty(document, 'visibilityState', { get: () => state, configurable: true })
    Object.defineProperty(document, 'hidden', { get: () => state === 'hidden', configurable: true })
    ;(window as unknown as { setVisibility: (s: DocumentVisibilityState) => void }).setVisibility =
      (s) => {
        state = s
        document.dispatchEvent(new Event('visibilitychange'))
      }
  })
  await adminTab.goto('/admin/dashboard')
  await adminTab.waitForLoadState('networkidle')

  // next-auth tells every other tab when the session changes; the hidden admin
  // tab re-reads it while the impersonation starts.
  const heardTheChange = adminTab.waitForResponse((r) => r.url().includes('/api/auth/session'))
  await page.bringToFront()
  await impersonate(page, artist)
  await heardTheChange
  await adminTab.waitForLoadState('networkidle')
  expect((await serverSession(context))?.impersonating?.name).toBe(artist)

  // The owner switches to that tab: it is an admin page, so the impersonation ends.
  await adminTab.bringToFront()
  await adminTab.evaluate(() =>
    (window as unknown as { setVisibility: (s: string) => void }).setVisibility('visible'),
  )
  await expect.poll(async () => (await serverSession(context))?.impersonating).toBeUndefined()
  await expect(adminTab.getByText('Viewing as')).toHaveCount(0)
})

test('logging out ends the impersonation, so logging back in starts as the admin', async ({
  page,
  context,
}) => {
  const artist = await anArtist()
  const tokenBeforeImpersonating = await loginToken(context)
  expect(tokenBeforeImpersonating).toBeDefined()
  await impersonate(page, artist)

  await page.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL((url) => url.pathname === '/')

  // Logging back in (same browser, same admin) without spending a real login
  // on the rate-limited code endpoint: restore the admin's own login cookie.
  await context.addCookies([tokenBeforeImpersonating!])
  const session = await serverSession(context)
  expect(session?.user).toBeDefined()
  expect(session?.impersonating).toBeUndefined()
})

test.describe('as an artist', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  // The impersonation cookie is not signed: the server must refuse to honor it
  // for anyone but an admin, or any artist could act as any other artist.
  test('an artist cannot impersonate, through the endpoint or with a hand-made cookie', async ({
    context,
    baseURL,
  }) => {
    const me = await serverSession(context)
    expect(me?.user?.id).toBeDefined()
    const victim = await prisma.user.findFirstOrThrow({
      where: { id: { not: me!.user!.id }, userType: { notIn: ['admin', 'superAdmin'] } },
      select: { id: true },
    })

    const viaEndpoint = await context.request.post('/api/admin/impersonation', {
      data: { userId: victim.id },
    })
    expect(viaEndpoint.status()).toBe(403)
    expect((await serverSession(context))?.impersonating).toBeUndefined()

    await context.addCookies([
      { name: 'impersonating', value: `${me!.user!.id}:${victim.id}`, url: baseURL! },
    ])
    expect((await serverSession(context))?.impersonating).toBeUndefined()
  })
})
