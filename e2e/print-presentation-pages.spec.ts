import { test, expect, type Locator, type Page } from '@playwright/test'

import { Prisma } from '@/generated/prisma'
import { bakeBackend } from '@/lib/bake/bakeStorage'
import { presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import type { PrintPresentationRecord } from '@/lib/printPresentation/record'
import prisma from '@/lib/prisma'
import { getPrintPresentationsEnabled, setPrintPresentationsEnabled } from '@/lib/settings'

import { fixtures, routes } from './fixtures'
import {
  BLANK,
  removeRenderFiles,
  stashRenderFiles,
  writeBlankRender,
  type BlankShape,
} from './presentation-helpers'

/**
 * Print presentations on the public pages: with the switch on, a work with a stored render shows
 * as a photo of the print — the render (frame or sheet) over the original image, which sits
 * untouched in the render's window. An out-of-date render stays up until it's re-rendered, unless
 * it would show the work wrongly (another edition, another shape). Switch off, no render, a render
 * stored elsewhere, or a render file that won't load: the page shows the plain image, as before.
 *
 * The renders are blank transparent WebPs at the stored sizes, written on the local backend
 * (BAKE_STORAGE=local) under the work's real file names; whatever real render was there is put
 * back afterwards.
 */

const WINDOW = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }

test.describe.configure({ mode: 'serial' })

let artworkId: string
let artworkSlug: string
let imageUrl: string
let saved: Prisma.JsonValue | null
let switchWas: boolean
let fingerprint: string
let inputs: NonNullable<ReturnType<typeof presentationInputs>>
let stash: { restore: () => Promise<void> } | undefined

/** Stores a blank render of `shape` and a current record pointing at it. */
const present = async (shape: BlankShape, patch: Partial<PrintPresentationRecord> = {}) => {
  const urls = await writeBlankRender(artworkId, fingerprint, shape)
  const record: PrintPresentationRecord = {
    fingerprint,
    mode: inputs.mode,
    edition: inputs.edition,
    window: WINDOW,
    aspect: BLANK[shape].aspect,
    urls,
    renderedAt: new Date().toISOString(),
    ...patch,
  }
  await prisma.artwork.update({ where: { id: artworkId }, data: { printPresentation: record } })
  return record
}

/** What a render saved now says about its shot: the work's current frame, passepartout, shape. */
const shotOf = (i: typeof inputs): Partial<PrintPresentationRecord> => ({
  frame: i.frame ?? 'none',
  passepartout: i.passepartout,
  ratio: i.ratio,
})

/** The fixture work's presentation (grid card or artwork-page picture). */
const presentation = (page: Page) =>
  page.locator('[data-print-presentation]').filter({ has: page.locator(`img[src*="${imageUrl}"]`) })

/** The render image (a cropped piece also holds a blank stand-in that sizes it). */
const renderOf = (piece: Locator) => piece.locator('img[aria-hidden="true"]:not([src^="data:"])')

/** The render sits exactly over its piece, and the window where the record says. */
const expectFitted = async (piece: Locator) => {
  const render = renderOf(piece)
  const win = piece.locator('[data-print-presentation-window]')
  const [p, r, w] = [await piece.boundingBox(), await render.boundingBox(), await win.boundingBox()]
  expect(p && r && w).toBeTruthy()
  expect(r!.width).toBeGreaterThan(50)
  expect(Math.abs(r!.x - p!.x)).toBeLessThan(1.5)
  expect(Math.abs(r!.width - p!.width)).toBeLessThan(1.5)
  expect(Math.abs(r!.height - p!.height)).toBeLessThan(1.5)
  expect(Math.abs(w!.x - r!.x - WINDOW.x * r!.width)).toBeLessThan(1.5)
  expect(Math.abs(w!.y - r!.y - WINDOW.y * r!.height)).toBeLessThan(1.5)
  expect(Math.abs(w!.width - WINDOW.w * r!.width)).toBeLessThan(1.5)
  return r!
}

/**
 * AR-168: the artwork page crops the presentation to the piece — a thin border of wall round it,
 * the render overflowing that area on purpose — and shows it whole within one screen.
 */
const expectCropped = async (page: Page, piece: Locator) => {
  const p = await piece.boundingBox()
  const w = await piece.locator('[data-print-presentation-window]').boundingBox()
  expect(p && w).toBeTruthy()
  expect(p!.width).toBeGreaterThan(50)
  // The original sits inside the cropped piece.
  expect(w!.x).toBeGreaterThanOrEqual(p!.x - 1)
  expect(w!.y).toBeGreaterThanOrEqual(p!.y - 1)
  expect(w!.x + w!.width).toBeLessThanOrEqual(p!.x + p!.width + 1)
  expect(w!.y + w!.height).toBeLessThanOrEqual(p!.y + p!.height + 1)
  // Whole within one screen.
  expect(p!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 0.5)
  return p!
}

test.beforeAll(async () => {
  test.skip(bakeBackend() !== 'local', 'stores renders: run with BAKE_STORAGE=local, never on R2')
  // A work the fixture exhibition hangs: the exhibition grid must show it.
  const artwork = await prisma.artwork.findFirstOrThrow({
    where: { slug: fixtures.exhibitionArtworkSlug },
    select: { id: true, slug: true, imageUrl: true, printPresentation: true },
  })
  artworkId = artwork.id
  artworkSlug = artwork.slug
  imageUrl = artwork.imageUrl!
  saved = artwork.printPresentation
  switchWas = await getPrintPresentationsEnabled()
  const [source] = await loadPresentationSources({ ids: [artworkId] })
  inputs = presentationInputs(source)!
  fingerprint = inputs.fingerprint
  stash = await stashRenderFiles(artworkId, fingerprint)
})

test.afterAll(async () => {
  if (!artworkId) return
  await stash?.restore()
  await prisma.artwork.update({
    where: { id: artworkId },
    data: { printPresentation: saved ?? Prisma.DbNull },
  })
  await setPrintPresentationsEnabled(switchWas)
})

test('switch on: the exhibition grid shows the work in its render, the original in the window', async ({
  page,
}) => {
  const record = await present('wide')
  await setPrintPresentationsEnabled(true)
  await page.goto(routes.exhibition())
  const card = presentation(page)
  await expect(card).toHaveCount(1)
  await expect(renderOf(card)).toHaveAttribute('src', record.urls.small)
  const render = await expectFitted(card)
  expect(Math.abs(render.width / render.height - 1.25)).toBeLessThan(0.02)
  // The original file, unchanged, inside the window.
  await expect(
    card.locator(`[data-print-presentation-window] img[src*="${imageUrl}"]`),
  ).toHaveCount(1)
})

test('switch on: the artwork page shows the large render', async ({ page }) => {
  const record = await present('wide')
  await setPrintPresentationsEnabled(true)
  await page.goto(routes.artwork(artworkSlug))
  const picture = presentation(page)
  await expect(picture).toHaveCount(1)
  await expect(renderOf(picture)).toHaveAttribute('src', record.urls.large)
  await expectCropped(page, picture)
})

test('a tall render stays fitted where its height is capped: grid and artwork page', async ({
  page,
}) => {
  await present('tall')
  await setPrintPresentationsEnabled(true)
  await page.goto(routes.exhibition())
  const card = await expectFitted(presentation(page))
  expect(card.height).toBeLessThanOrEqual(600.5) // the grid's height cap binds: 600 × 0.5 wide
  await page.goto(routes.artwork(artworkSlug))
  await expectCropped(page, presentation(page))
})

test('on a wide retina screen the artwork page shows the whole piece within one screen', async ({
  browser,
}) => {
  await present('wide')
  await setPrintPresentationsEnabled(true)
  const context = await browser.newContext({
    viewport: { width: 2560, height: 1600 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.goto(routes.artwork(artworkSlug))
  await expectCropped(page, presentation(page))
  await context.close()
})

test('switch off: the pages are as they were', async ({ page }) => {
  await present('wide')
  await setPrintPresentationsEnabled(false)
  await page.goto(routes.exhibition())
  await expect(page.locator(`img[src*="${imageUrl}"]`).first()).toBeVisible()
  await expect(page.locator('[data-print-presentation]')).toHaveCount(0)
  await page.goto(routes.artwork(artworkSlug))
  await expect(page.locator('[data-print-presentation]')).toHaveCount(0)
})

test('an out-of-date render stays up until it is re-rendered', async ({ page }) => {
  // e.g. its frame or passepartout changed since: the old shot, under its own file names.
  const old = 'deadbeef'
  const urls = await writeBlankRender(artworkId, old, 'wide')
  try {
    await present('wide', { fingerprint: old, urls, ...shotOf(inputs) })
    await setPrintPresentationsEnabled(true)
    await page.goto(routes.exhibition())
    const card = presentation(page)
    await expect(card).toHaveCount(1)
    await expect(renderOf(card)).toHaveAttribute('src', urls.small)
    await expectFitted(card)
    await page.goto(routes.artwork(artworkSlug))
    const picture = presentation(page)
    await expect(renderOf(picture)).toHaveAttribute('src', urls.large)
    await expectCropped(page, picture)
  } finally {
    await removeRenderFiles(artworkId, old)
  }
})

test('an out-of-date render that would show the work wrongly gives way to the plain image', async ({
  page,
}) => {
  const old = 'deadbeef'
  const urls = await writeBlankRender(artworkId, old, 'wide')
  try {
    for (const wrong of [
      // Another edition: a wrong pencilled number.
      { mode: 'limited' as const, edition: (inputs.edition ?? 0) + 30 },
      // Another shape: the original would no longer fill the window.
      { ratio: inputs.ratio * 1.25 },
    ]) {
      await present('wide', { fingerprint: old, urls, ...shotOf(inputs), ...wrong })
      await setPrintPresentationsEnabled(true)
      await page.goto(routes.exhibition())
      await expect(page.locator(`img[src*="${imageUrl}"]`).first()).toBeVisible()
      await expect(presentation(page)).toHaveCount(0)
    }
  } finally {
    await removeRenderFiles(artworkId, old)
  }
})

test('a render stored on another backend is not this one: the page shows the plain image', async ({
  page,
}) => {
  // e.g. renders made on a laptop (local files) seen from staging, which shares the database.
  await present('wide', {
    urls: { large: '/elsewhere/x-1800.webp', small: '/elsewhere/x-900.webp' },
  })
  await setPrintPresentationsEnabled(true)
  await page.goto(routes.exhibition())
  await expect(page.locator(`img[src*="${imageUrl}"]`).first()).toBeVisible()
  await expect(presentation(page)).toHaveCount(0)
})

test('a render file that will not load leaves the plain image, never an empty card', async ({
  page,
}) => {
  await present('wide')
  await removeRenderFiles(artworkId, fingerprint)
  await setPrintPresentationsEnabled(true)
  for (const url of [routes.exhibition(), routes.artwork(artworkSlug)]) {
    await page.goto(url)
    const image = page.locator(`img[src*="${imageUrl}"]`).first()
    await expect(image).toBeVisible()
    await expect(presentation(page)).toHaveCount(0)
    const box = await image.boundingBox()
    expect(box!.width).toBeGreaterThan(50)
    expect(box!.height).toBeGreaterThan(50)
  }
})

test('the artist profile shows it among the featured works', async ({ page }) => {
  await present('wide')
  await setPrintPresentationsEnabled(true)
  const { featured } = await prisma.artwork.findUniqueOrThrow({
    where: { id: artworkId },
    select: { featured: true },
  })
  // Featured for this check only, if it wasn't.
  if (!featured) await prisma.artwork.update({ where: { id: artworkId }, data: { featured: true } })
  try {
    await page.goto(routes.artistProfile())
    await expect(presentation(page)).toHaveCount(1)
  } finally {
    if (!featured) {
      await prisma.artwork.update({ where: { id: artworkId }, data: { featured: false } })
    }
  }
})

test('the prints page shows it, when the work is in the selection', async ({ page }) => {
  await present('wide')
  await setPrintPresentationsEnabled(true)
  const selected = await prisma.selectedPrint.count({ where: { artworkId } })
  test.skip(!selected, 'the fixture work is not in the print selection')
  await page.goto('/prints')
  await expect(presentation(page)).toHaveCount(1)
})
