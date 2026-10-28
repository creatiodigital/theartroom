import { test, expect } from '@playwright/test'

import { Prisma } from '@/generated/prisma'
import { bakeBackend } from '@/lib/bake/bakeStorage'
import { presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import type { PrintPresentationRecord } from '@/lib/printPresentation/record'
import { deletePresentationFiles } from '@/lib/printPresentation/storage'
import prisma from '@/lib/prisma'
import { getPrintPresentationsEnabled, setPrintPresentationsEnabled } from '@/lib/settings'

import { fixtures } from './fixtures'
import { BLANK, writeBlankRender } from './presentation-helpers'

/**
 * The admin's "Print presentations" page: every image work with the state of its presentation
 * (missing, out of date, up to date, not eligible), the go-live switch, and the render controls.
 * Never presses Render — rendering is WebGL, which e2e doesn't run. On its own temporary artwork,
 * with blank renders on the local backend (BAKE_STORAGE=local).
 */

const PAGE = '/admin/print-presentations'

test.describe.configure({ mode: 'serial' })
test.use({ storageState: 'e2e/.auth/admin.json' })

let artworkId: string
let switchWas: boolean
let record: PrintPresentationRecord

const setRecord = (value: PrintPresentationRecord | null) =>
  prisma.artwork.update({
    where: { id: artworkId },
    data: { printPresentation: value ?? Prisma.DbNull },
  })

test.beforeAll(async () => {
  test.skip(bakeBackend() !== 'local', 'stores renders: run with BAKE_STORAGE=local, never on R2')
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true },
  })
  // Sweep what a crashed earlier run left behind.
  await prisma.artwork.deleteMany({ where: { slug: { startsWith: 'e2e-presentation-admin-' } } })
  const artwork = await prisma.artwork.create({
    data: {
      userId: owner.id,
      name: 'E2E Presentation Admin',
      slug: `e2e-presentation-admin-${Date.now()}`,
      artworkType: 'image',
      imageUrl: '/e2e-presentation-admin.webp',
      // A tall work: its preview is capped by height, where a loose wrapper would misalign it.
      originalWidth: 2000,
      originalHeight: 4000,
    },
    select: { id: true },
  })
  artworkId = artwork.id
  switchWas = await getPrintPresentationsEnabled()
  const [source] = await loadPresentationSources({ ids: [artworkId] })
  const inputs = presentationInputs(source)!
  record = {
    fingerprint: inputs.fingerprint,
    mode: inputs.mode,
    edition: inputs.edition,
    window: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
    aspect: BLANK.tall.aspect,
    urls: await writeBlankRender(artworkId, inputs.fingerprint, 'tall'),
    renderedAt: new Date().toISOString(),
  }
})

test.afterAll(async () => {
  if (!artworkId) return
  await deletePresentationFiles(record, artworkId)
  await prisma.artwork.delete({ where: { id: artworkId } })
  await setPrintPresentationsEnabled(switchWas)
})

const statusOf = (page: import('@playwright/test').Page) =>
  page.locator(`[data-artwork-id="${artworkId}"] [data-status]`)

test('a work with a current render reads "Up to date"', async ({ page }) => {
  await setRecord(record)
  await page.goto(PAGE)
  await expect(page.getByRole('heading', { name: 'Print presentations' })).toBeVisible()
  await expect(statusOf(page)).toHaveText('Up to date')
  await expect(page.getByText(/Up to date: \d+/)).toBeVisible()
})

test('its preview is the render, fitted around the window', async ({ page }) => {
  await setRecord(record)
  await page.goto(PAGE)
  const piece = page.locator(`[data-artwork-id="${artworkId}"] [data-print-presentation]`)
  const render = piece.locator('img[aria-hidden="true"]')
  const win = piece.locator('[data-print-presentation-window]')
  await expect(render).toBeVisible()
  const [p, r, w] = [await piece.boundingBox(), await render.boundingBox(), await win.boundingBox()]
  expect(Math.abs(r!.width - p!.width)).toBeLessThan(1.5)
  expect(Math.abs(r!.height - p!.height)).toBeLessThan(1.5)
  expect(Math.abs(w!.x - r!.x - 0.2 * r!.width)).toBeLessThan(1.5)
  expect(Math.abs(w!.width - 0.6 * r!.width)).toBeLessThan(1.5)
})

test('a render stored on another backend reads "Out of date"', async ({ page }) => {
  // Renders made on a laptop (local files), seen from staging, which shares the database.
  await setRecord({
    ...record,
    urls: { large: '/elsewhere/x-1800.webp', small: '/elsewhere/x-900.webp' },
  })
  await page.goto(PAGE)
  await expect(statusOf(page)).toHaveText('Out of date')
})

test('a work whose render no longer fits reads "Out of date"', async ({ page }) => {
  await setRecord({ ...record, fingerprint: 'deadbeef' })
  await page.goto(PAGE)
  await expect(statusOf(page)).toHaveText('Out of date')
})

test('a work with no render reads "Missing"', async ({ page }) => {
  await setRecord(null)
  await page.goto(PAGE)
  await expect(statusOf(page)).toHaveText('Missing')
})

test('an image work of unknown shape reads "Not eligible"', async ({ page }) => {
  // No original size and no web image to measure.
  const unknown = await prisma.artwork.findFirst({
    where: {
      artworkType: 'image',
      imageUrl: null,
      presentationRatio: null,
      OR: [{ originalWidth: null }, { originalHeight: null }],
    },
    select: { id: true },
  })
  test.skip(!unknown, 'no image work of unknown shape in this database')
  await page.goto(PAGE)
  await expect(page.locator(`[data-artwork-id="${unknown!.id}"] [data-status]`)).toHaveText(
    'Not eligible',
  )
})

test('the switch turns the presentations on and off for the site', async ({ page }) => {
  await setPrintPresentationsEnabled(false)
  await page.goto(PAGE)
  const toggle = page.getByLabel('Show print presentations on the site')
  await expect(toggle).not.toBeChecked()
  await page.locator('label', { has: toggle }).click()
  await expect(toggle).toBeChecked()
  await expect.poll(() => getPrintPresentationsEnabled()).toBe(true)
  await page.locator('label', { has: toggle }).click()
  await expect(toggle).not.toBeChecked()
  await expect.poll(() => getPrintPresentationsEnabled()).toBe(false)
})

test.describe('as an artist', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test('the page is admin only', async ({ page }) => {
    await page.goto(PAGE)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: 'Print presentations' })).toHaveCount(0)
  })
})
