import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'

import { seedCookieConsent } from './consent-helpers'
import { fixtures } from './fixtures'

/**
 * The 3D walk-through is for laptops and desktops with a mouse or trackpad —
 * it walks on the keyboard and looks around on hold-and-drag. Everything else
 * gets the "open this on a laptop or desktop" note instead of the button, and
 * the /visit route itself turns them away with the same message.
 *
 * Size alone cannot decide this: a 13" iPad held sideways is 1376px wide,
 * wider than many laptops. So the devices below are told apart by how they
 * are driven, not by how big they are.
 *
 * The /visit checks only ever load the WebGL-free fallback (see memory: no
 * WebGL e2e) — the desktop side of /visit is never opened here.
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

// Safari on iPadOS identifies itself as a Mac. What gives it away is the
// multi-touch screen, which no Mac has.
const MAC_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'

const LAPTOP_SIZED_IPAD = { width: 1376, height: 1032 }

async function setTouchPoints(page: Page, points: number) {
  await page.addInitScript((n) => {
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => n })
  }, points)
}

const enterButton = (page: Page) => page.getByRole('link', { name: 'Enter Virtual Exhibition' })
const laptopNote = (page: Page) => page.getByText(/open this page on a laptop or desktop/i)

async function expectTurnedAway(page: Page) {
  await page.goto(exhibitionPath)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(laptopNote(page)).toBeVisible()
  await expect(enterButton(page)).toBeHidden()

  await page.goto(`${exhibitionPath}/visit`)
  await expect(page.getByRole('heading', { name: /step inside on a bigger screen/i })).toBeVisible()
}

async function expectInvitedIn(page: Page) {
  await page.goto(exhibitionPath)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(enterButton(page)).toBeVisible()
  await expect(laptopNote(page)).toBeHidden()
}

test.describe('touch-only iPad, held sideways', () => {
  test.use({ viewport: LAPTOP_SIZED_IPAD, userAgent: MAC_SAFARI_UA, hasTouch: true })

  test('gets the laptop note, and /visit turns it away', async ({ page }) => {
    await seedCookieConsent(page)
    await setTouchPoints(page, 5)
    await expectTurnedAway(page)
  })
})

test.describe('iPad with a keyboard and trackpad attached', () => {
  // A trackpad can make an iPad report a fine, hovering pointer — exactly what
  // a laptop reports. The multi-touch screen still marks it as an iPad.
  test.use({ viewport: LAPTOP_SIZED_IPAD, userAgent: MAC_SAFARI_UA })

  test('is still treated as an iPad', async ({ page }) => {
    await seedCookieConsent(page)
    await setTouchPoints(page, 5)
    await expectTurnedAway(page)
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

test.describe('Windows laptop with a touchscreen', () => {
  // Its main pointer is the trackpad, so it can walk the room like any laptop.
  test.use({ viewport: { width: 1366, height: 768 }, userAgent: WINDOWS_CHROME_UA })

  test('is invited into the 3D space', async ({ page }) => {
    await seedCookieConsent(page)
    await setTouchPoints(page, 10)
    await expectInvitedIn(page)
  })
})
