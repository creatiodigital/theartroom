import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'
import { ctaColors, exhibitionOfUrl } from '@/lib/slideVisitUrls'

import { fixtures, routes } from './fixtures'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The way into an exhibition's 3D room from the homepage. The hero had an "Enter Virtual
 * Exhibition" button per slide (colors picked per slide); the owner removed it from the hero in
 * AR-174 ("too invasive"), so the slide leads to the exhibition page. The homepage's exhibition
 * cards offer "View Exhibition | Enter 3D Room" instead, the room only once its space is
 * published. The slide's Enter colors are still saved from admin. Never enters the room (WebGL).
 *
 * On two exhibitions of its own (the fixture artist's), one with its 3D space published and one
 * without, and slides of its own, all deleted afterwards.
 */

const PREFIX = 'e2e-enter-3d-'

let withSpace: string
let withoutSpace: string
const slideIds: string[] = []

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  // Sweep what a crashed earlier run left behind.
  await prisma.slide.deleteMany({ where: { title: 'E2E Enter Slide' } })
  await prisma.exhibition.deleteMany({ where: { url: { startsWith: PREFIX } } })
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const stamp = Date.now()
  const create = async (spacePublished: boolean) => {
    const url = `${PREFIX}${spacePublished ? 'on' : 'off'}-${stamp}`
    await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: `E2E Enter 3D ${spacePublished ? 'On' : 'Off'}`,
        url,
        spaceId: 'paris',
        status: 'current',
        published: true,
        spacePublished,
      },
    })
    return `/exhibitions/${owner.handler}/${url}`
  }
  withSpace = await create(true)
  withoutSpace = await create(false)
})

test.afterAll(async () => {
  await prisma.slide.deleteMany({ where: { id: { in: slideIds } } })
  await prisma.exhibition.deleteMany({ where: { url: { startsWith: PREFIX } } })
})

/** A slide shown first (so it's the one on screen when the page opens). */
const createSlide = async (exhibitionUrl: string, order = -1000) => {
  const slide = await prisma.slide.create({
    data: {
      imageUrl: '/assets/person.png?e2e=enter-3d',
      title: 'E2E Enter Slide',
      subtitle: 'E2E',
      meta: '',
      exhibitionUrl,
      order,
      isActive: true,
      ctaBackgroundColor: '#123456',
      ctaTextColor: '#fedcba',
    },
  })
  slideIds.push(slide.id)
  return slide
}

/** A slide's own box: the parent of its image link. */
const slideBox = (page: Page, exhibitionUrl: string) =>
  page.locator(`a[href="${exhibitionUrl}"]`).first().locator('xpath=..')

test("a slide's link names its exhibition whatever site it's on, and only an exhibition", () => {
  const path = '/exhibitions/jane-smith/sunsets'
  expect(exhibitionOfUrl(`https://staging.theartroom.gallery${path}`)?.path).toBe(path)
  expect(exhibitionOfUrl(`${path}/`)?.path).toBe(path)
  expect(exhibitionOfUrl('/about')).toBeNull()
  expect(exhibitionOfUrl(`${path}/visit`)).toBeNull()
})

test('the hero slide has no Enter button and opens its exhibition page', async ({ page }) => {
  // Removed from the homepage hero in AR-174 (owner: "too invasive"), even when the exhibition's
  // 3D space is published; the exhibition page keeps its own button.
  await createSlide(withSpace)
  await page.goto('/')
  await expect(slideBox(page, withSpace)).toBeVisible()
  await expect(slideBox(page, withSpace).locator('a[href$="/visit"]')).toHaveCount(0)
  await page
    .locator(`a[href="${withSpace}"]`)
    .first()
    .click({ position: { x: 40, y: 40 } })
  await expect(page).toHaveURL(new RegExp(`${withSpace}$`))
})

test('a homepage card offers its exhibition page, and its 3D room only once published', async ({
  page,
}) => {
  // Both test exhibitions are the newest current ones, so they're among the homepage's six.
  await page.goto('/')
  const roomLink = page.locator(`a[href="${withSpace}/visit"]`)
  await expect(roomLink).toHaveCount(1)
  await expect(roomLink).toHaveText('Enter 3D Room')
  await expect(
    page.getByRole('link', { name: 'View Exhibition' }).and(page.locator(`[href="${withSpace}"]`)),
  ).toHaveCount(1)
  await expect(page.locator(`a[href="${withoutSpace}"]`).first()).toBeVisible()
  await expect(page.locator(`a[href="${withoutSpace}/visit"]`)).toHaveCount(0)
  // Links side by side, never one inside another.
  await expect(page.locator('a a')).toHaveCount(0)
})

for (const [where, path] of [
  ['the exhibitions list', '/exhibitions'],
  ['the artist page', routes.artistProfile()],
] as const) {
  // A second LINE into the 3D room under the card's link was tried and dropped (owner,
  // 2026-11-03: "looks hideous"); one row, "View Exhibition | Enter 3D Room", came in AR-174.
  test(`${where} offers each exhibition's page, and its 3D room only once published`, async ({
    page,
  }) => {
    await page.goto(path)
    await expect(page.locator(`a[href="${withSpace}/visit"]`)).toHaveText('Enter 3D Room')
    await expect(
      page
        .getByRole('link', { name: 'View Exhibition' })
        .and(page.locator(`[href="${withSpace}"]`)),
    ).toHaveCount(1)
    await expect(page.locator(`a[href="${withoutSpace}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href="${withoutSpace}/visit"]`)).toHaveCount(0)
    await expect(page.locator('a a')).toHaveCount(0)
  })
}

test("the slide's Enter colors are saved only as #rrggbb colors", async ({ page }) => {
  expect(ctaColors({ ctaBackgroundColor: '#000000', ctaTextColor: 'red; display:none' })).toEqual({
    ctaBackgroundColor: '#000000',
  })
  const slide = await createSlide('/e2e-enter-colors', -900)
  const put = await page.request.put(`/api/slides/${slide.id}`, {
    data: { ...slide, ctaBackgroundColor: '#ABCDEF', ctaTextColor: 'url(javascript:x)' },
  })
  expect(put.ok()).toBe(true)
  const row = await prisma.slide.findUniqueOrThrow({ where: { id: slide.id } })
  expect(row.ctaBackgroundColor).toBe('#ABCDEF')
  expect(row.ctaTextColor, 'not a color: left as it was').toBe('#fedcba')
})
