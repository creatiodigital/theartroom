import { test, expect, type Page } from '@playwright/test'

import prisma from '@/lib/prisma'
import { ctaColors, exhibitionOfUrl } from '@/lib/slideVisitUrls'

import { fixtures } from './fixtures'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The 3D exhibition is offered wherever an exhibition is, always as "Enter 3D room": the homepage
 * hero's button (its colors picked per slide), and a line under each exhibition card's "Visit
 * exhibition". Straight into /visit, only when the exhibition's 3D space is published, and only on
 * laptops and desktops. Never a link inside a link: the slide or the card still opens the
 * exhibition page, the Enter link its 3D space. Never enters it (WebGL).
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

test("the hero slide offers its exhibition's 3D room, in the colors picked for it", async ({
  page,
}) => {
  await createSlide(withSpace)
  await page.goto('/')
  const enter = slideBox(page, withSpace).locator(`a[href="${withSpace}/visit"]`)
  await expect(enter).toBeVisible()
  await expect(enter).toHaveText(/Enter 3D room/)
  await expect(enter).toHaveCSS('background-color', 'rgb(18, 52, 86)')
  await expect(enter).toHaveCSS('color', 'rgb(254, 220, 186)')
  // Two links side by side, never one inside the other.
  await expect(page.locator('a a')).toHaveCount(0)
  // The slide itself still opens the exhibition page: a click on the image, away from the button.
  await page
    .locator(`a[href="${withSpace}"]`)
    .first()
    .click({ position: { x: 40, y: 40 } })
  await expect(page).toHaveURL(new RegExp(`${withSpace}$`))
})

test('no button when the 3D space is not published, or the slide opens something else', async ({
  page,
}) => {
  await createSlide(withoutSpace, -1001)
  await createSlide('/about', -1002)
  await page.goto('/')
  for (const url of [withoutSpace, '/about']) {
    await expect(slideBox(page, url).locator('a[href$="/visit"]')).toHaveCount(0)
  }
})

test('an exhibition card offers its 3D room under "Visit exhibition"', async ({ page }) => {
  await page.goto('/exhibitions')
  const info = page.locator(`a[href="${withSpace}"]`).first().locator('xpath=..')
  await expect(info.locator(`a[href="${withSpace}/visit"]`)).toHaveText('Enter 3D room')
  await expect(page.locator('a a')).toHaveCount(0)
  // None for the exhibition without one.
  await expect(page.locator(`a[href="${withoutSpace}/visit"]`)).toHaveCount(0)
  // A click anywhere else on the card, its image say, still opens the exhibition page.
  const imageArea = info.locator('xpath=..').locator('xpath=./div[1]')
  await imageArea.scrollIntoViewIfNeeded()
  const image = await imageArea.boundingBox()
  await page.mouse.click(image!.x + image!.width / 2, image!.y + image!.height / 2)
  await expect(page).toHaveURL(new RegExp(`${withSpace}$`))
})

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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('neither the hero nor the cards offer the 3D room', async ({ page }) => {
    await createSlide(withSpace, -1003)
    for (const url of ['/', '/exhibitions']) {
      await page.goto(url)
      await expect(page.locator(`a[href="${withSpace}/visit"]`)).toHaveCount(0)
    }
  })
})
