import { test, expect, type BrowserContext, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'

/**
 * The artist studio's frame (redesign step 14, artist.md §0): the light side
 * menu, its active rules, the phone drawer, the pages that stay bare, and the
 * impersonation card + phone pill. Read-only: nothing is saved, nobody logs
 * out, and Stop is never pressed (the impersonation spec covers it).
 */

/** Who this browser is signed in as. */
async function sessionUserId(context: BrowserContext): Promise<string> {
  const res = await context.request.get('/api/auth/session')
  const session = (await res.json()) as { user?: { id: string } } | null
  expect(session?.user?.id).toBeDefined()
  return session!.user!.id
}

const artistNav = (page: Page) => page.getByRole('navigation', { name: 'Artist' })

/** The menu item that is lit, by its exact name. */
async function expectCurrent(page: Page, name: string) {
  await expect(artistNav(page).getByRole('link', { name, exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
}

test.describe('as an artist', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test.beforeEach(async ({ page }) => {
    await seedCookieConsent(page)
  })

  test('the side menu: items, foot and no impersonation card', async ({ page, context }) => {
    const userId = await sessionUserId(context)
    const { handler } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { handler: true },
    })

    await page.goto('/dashboard')
    const nav = artistNav(page)
    await expectCurrent(page, 'Home')
    for (const name of ['Artworks', 'Profile', 'Payouts']) {
      await expect(nav.getByRole('link', { name, exact: true })).not.toHaveAttribute(
        'aria-current',
        'page',
      )
    }
    await expect(nav.getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/dashboard/change-password',
    )
    await expect(nav.getByRole('button', { name: 'Log out' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /View my public page/ })).toHaveAttribute(
      'href',
      `/artists/${handler}`,
    )
    await expect(page.getByText('Viewing as')).toHaveCount(0)
  })

  test('active item: the artwork editor keeps Artworks, exhibition settings keep Home', async ({
    page,
    context,
  }) => {
    const userId = await sessionUserId(context)
    const [artwork, exhibition] = await Promise.all([
      prisma.artwork.findFirst({ where: { userId }, select: { id: true }, orderBy: { id: 'asc' } }),
      prisma.exhibition.findFirst({
        where: { userId },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ])

    await page.goto('/dashboard/artworks')
    await expectCurrent(page, 'Artworks')

    if (artwork) {
      await page.goto(`/dashboard/artworks/${artwork.id}/edit`)
      await expectCurrent(page, 'Artworks')
    }
    if (exhibition) {
      await page.goto(`/dashboard/exhibitions/${exhibition.id}/settings`)
      await expectCurrent(page, 'Home')
    }

    await page.goto('/dashboard/profile')
    await expectCurrent(page, 'Profile')
  })

  test('login and the password screen stay outside the frame', async ({ page }) => {
    await page.goto('/dashboard/change-password')
    await expect(page.getByRole('heading', { name: 'Set Your Password' })).toBeVisible()
    await expect(artistNav(page)).toHaveCount(0)

    await page.goto('/dashboard/login')
    await expect(page.locator('form').first()).toBeVisible()
    await expect(artistNav(page)).toHaveCount(0)
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('the menu opens as a drawer, Escape closes it and focus comes back', async ({ page }) => {
      await page.goto('/dashboard')
      const menuButton = page.getByRole('button', { name: 'Open menu' })
      await expect(menuButton).toBeInViewport()
      await menuButton.click()

      const drawer = page.getByRole('dialog', { name: 'Artist menu' })
      await expect(drawer).toBeVisible()
      await expect(drawer.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(drawer.getByRole('button', { name: 'Log out' })).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(menuButton).toBeFocused()
    })
  })
})

test.describe('as an admin impersonating an artist, on a phone', () => {
  test.use({ storageState: 'e2e/.auth/admin.json', viewport: { width: 390, height: 844 } })

  test('the "Viewing as" pill opens the drawer with the card and Stop', async ({
    page,
    context,
  }) => {
    const artist = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist' },
      select: { id: true, name: true, lastName: true },
      orderBy: { id: 'asc' },
    })
    const fullName = `${artist.name} ${artist.lastName}`.trim()

    await seedCookieConsent(page)
    // What Impersonate on /admin/users does (useEffectiveUser.startImpersonation).
    const started = await context.request.post('/api/admin/impersonation', {
      data: { userId: artist.id },
    })
    expect(started.ok()).toBe(true)

    try {
      await page.goto('/dashboard')
      const pill = page.getByRole('button', { name: `Viewing as ${fullName}` })
      await expect(pill).toBeInViewport()
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeInViewport()

      await pill.click()
      const drawer = page.getByRole('dialog', { name: 'Artist menu' })
      await expect(drawer.getByRole('status')).toContainText(`Viewing as ${fullName}`)
      await expect(drawer.getByRole('button', { name: 'Stop impersonating' })).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(drawer).toHaveCount(0)
      await expect(pill).toBeFocused()
    } finally {
      // Leave the admin as the admin (the cookie would end with the context anyway).
      await context.request.delete('/api/admin/impersonation')
    }
  })
})
