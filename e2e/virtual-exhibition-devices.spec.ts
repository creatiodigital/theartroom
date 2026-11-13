import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { fixtures } from './fixtures'

/**
 * Every device can step into the 3D exhibition (AR-172). Phones and tablets
 * walk it with their own touch controls; until then they got an "open this page
 * on a laptop or desktop" note instead of the button, and /visit turned them
 * away.
 *
 * So each device below must be offered the button, and none of them the old
 * note. The room itself is never opened here (see memory: no WebGL e2e) — the
 * touch controls are tried by hand, on the simulator and a real device.
 *
 * The button only exists when the exhibition's 3D space is published, which no
 * fixture exhibition has, so this spec makes its own and removes it after.
 */

let exhibitionId = ''
let exhibitionPath = ''

test.beforeAll(async () => {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const url = `e2e-devices-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: 'E2E Devices',
      url,
      spaceId: 'paris',
      status: 'published',
      published: true,
      spacePublished: true,
    },
  })
  exhibitionId = exhibition.id
  exhibitionPath = `/exhibitions/${owner.handler}/${url}`
})

test.afterAll(async () => {
  if (exhibitionId) await prisma.exhibition.delete({ where: { id: exhibitionId } })
})

// Safari on iPadOS identifies itself as a Mac; the multi-touch screen is what
// tells them apart.
const MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

async function setTouchPoints(page: Page, points: number) {
  await page.addInitScript((n) => {
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => n })
  }, points)
}

// The exhibition page has two ways in (the hero and the "Walk through the exhibition" band, public
// step 27): the first is the hero's.
const enterButton = (page: Page) => page.getByRole('link', { name: 'Enter 3D Room' }).first()
const laptopNote = (page: Page) => page.getByText(/open this page on a laptop or desktop/i)

async function expectInvitedIn(page: Page) {
  await page.goto(exhibitionPath)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(enterButton(page)).toBeVisible()
  await expect(laptopNote(page)).toHaveCount(0)
}

test.describe('iPhone, held upright', () => {
  test.use({
    viewport: { width: 393, height: 852 },
    userAgent: IPHONE_SAFARI_UA,
    hasTouch: true,
    isMobile: true,
  })

  test('is invited into the 3D space', async ({ page }) => {
    await seedCookieConsent(page)
    await setTouchPoints(page, 5)
    await expectInvitedIn(page)
  })
})

test.describe('touch-only iPad, held sideways', () => {
  test.use({ viewport: { width: 1376, height: 1032 }, userAgent: MAC_SAFARI_UA, hasTouch: true })

  test('is invited into the 3D space', async ({ page }) => {
    await seedCookieConsent(page)
    await setTouchPoints(page, 5)
    await expectInvitedIn(page)
  })
})

test.describe('Mac laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, userAgent: MAC_SAFARI_UA })

  test('is invited into the 3D space', async ({ page }) => {
    await seedCookieConsent(page)
    await setTouchPoints(page, 0)
    await expectInvitedIn(page)
  })
})
