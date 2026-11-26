import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'

import prisma from '@/lib/prisma'
import { presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import { photoInputs, renderCopy } from '@/lib/printPresentation/photoInputs'
import type { PrintPresentationRecord } from '@/lib/printPresentation/record'
import {
  newRenderId,
  photoPublicUrls,
  presentationPublicUrls,
} from '@/lib/printPresentation/storage'
import { getPrintPresentationsEnabled } from '@/lib/settings'

import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The artwork page with a work's four images (owner, 2026-11-20): the framed view first, then the
 * three photos of the print. Tablets and desktop: a 2 × 2 grid below Inquire switches the grey
 * box. Phones: one row of four under the box, and the box swipes. A work with only its framed
 * render (or none) shows no grid. The stored files needn't exist: the page is read, not the photos.
 */
const IMAGE = 'https://assets.example/e2e-artwork-photo-views.webp'

async function renderedWork(withPhotos: boolean) {
  const fx = await setupLimitedFixture(5)
  await prisma.artwork.update({
    where: { id: fx.artworkId },
    data: { imageUrl: IMAGE, title: `E2E Views ${fx.slug}` },
  })
  const [source] = await loadPresentationSources({ ids: [fx.artworkId] })
  const inputs = presentationInputs(source)!
  const photo = photoInputs(source, inputs)!
  const renderId = newRenderId()
  const record: PrintPresentationRecord = {
    fingerprint: inputs.fingerprint,
    mode: inputs.mode,
    edition: inputs.edition,
    window: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    aspect: 1,
    urls: presentationPublicUrls(fx.artworkId, inputs.fingerprint, renderId),
    renderedAt: new Date().toISOString(),
    frame: inputs.frame ?? 'none',
    passepartout: inputs.passepartout,
    ratio: inputs.ratio,
    renderId,
    copy: renderCopy(source, inputs)!,
    ...(withPhotos
      ? {
          views: {
            fingerprint: photo.fingerprint,
            urls: photoPublicUrls(fx.artworkId, photo.fingerprint, renderId),
            renderedAt: new Date().toISOString(),
          },
        }
      : {}),
  }
  await prisma.artwork.update({ where: { id: fx.artworkId }, data: { printPresentation: record } })
  return fx
}

const tiles = (page: Page) => page.getByRole('group', { name: /views of the print/i })

test.describe('the four views on the artwork page', () => {
  test.beforeEach(async () => {
    test.skip(!(await getPrintPresentationsEnabled()), 'presentations are switched off')
  })

  test('desktop: a 2 × 2 grid below the action; picking a view shows it in the box', async ({
    page,
  }) => {
    const fx = await renderedWork(true)
    try {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/artworks/${fx.slug}`)
      const grid = tiles(page).filter({ visible: true }).first()
      const buttons = grid.getByRole('button')
      await expect(buttons).toHaveCount(4)
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true')
      await expect(buttons.nth(0)).toHaveAccessibleName(/the print: framed/i)
      await expect(buttons.nth(1)).toHaveAccessibleName(/unframed, its corner/i)
      await expect(buttons.nth(2)).toHaveAccessibleName(/a detail$/i)
      await expect(buttons.nth(3)).toHaveAccessibleName(/a detail at its top edge/i)
      // Below the column's action (Order a print, or Inquire when there is nothing to order).
      const action = page.getByRole('button', { name: /^(inquire|order a print)$/i }).first()
      const [gridBox, actionBox] = [await grid.boundingBox(), await action.boundingBox()]
      expect(gridBox!.y).toBeGreaterThan(actionBox!.y)
      await buttons.nth(1).click()
      await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('img[src*="-sheet-2400.webp"]')).toBeInViewport()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  // The framed tile was drawn narrower than the work (owner, 2026-11-26): the tile is a bare Button,
  // whose `align-items: stretch` stretched the presentation to the tile's height while it kept the
  // stand-in's width, and the frame and the image, placed in percentages of it, were squeezed.
  test('desktop: the framed tile keeps the work’s shape, centred in its tile', async ({ page }) => {
    const fx = await renderedWork(true)
    try {
      // The stored files don't exist, and a render that fails to load falls back to the plain
      // image (no presentation). Serve a stand-in picture for this work's files, so the tile lays
      // out its real presentation.
      const picture = await sharp({
        create: { width: 900, height: 900, channels: 3, background: '#f2f2f2' },
      })
        .png()
        .toBuffer()
      await page.route(
        (url) => url.href.includes(fx.artworkId),
        (route) => route.fulfill({ contentType: 'image/png', body: picture }),
      )
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/artworks/${fx.slug}`)
      const tile = tiles(page).filter({ visible: true }).first().getByRole('button').first()
      await expect(tile).toBeVisible()
      const m = await tile.evaluate((el) => {
        const piece = el.querySelector('[data-print-presentation]')!
        // The stand-in: the piece's one image in flow; it has the cropped area's own shape.
        const standIn = [...piece.querySelectorAll(':scope > img')].find(
          (img) => getComputedStyle(img).position !== 'absolute',
        )!
        const [t, p, s] = [el, piece, standIn].map((n) => n.getBoundingClientRect())
        return {
          pieceRatio: p.width / p.height,
          standInRatio: s.width / s.height,
          gapAbove: p.top - t.top,
          gapBelow: t.bottom - p.bottom,
        }
      })
      expect(m.pieceRatio).toBeCloseTo(m.standInRatio, 2)
      expect(Math.abs(m.gapAbove - m.gapBelow)).toBeLessThan(1.5)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('phone: one row of four under the photo, and the photo swipes', async ({ page }) => {
    const fx = await renderedWork(true)
    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/artworks/${fx.slug}`)
      const row = tiles(page).filter({ visible: true })
      await expect(row).toHaveCount(1)
      await expect(row.getByRole('button')).toHaveCount(4)
      const track = page.locator('[data-views-track]')
      const [rowBox, trackBox] = [await row.boundingBox(), await track.boundingBox()]
      expect(rowBox!.y).toBeGreaterThan(trackBox!.y + trackBox!.height - 1)
      // A swipe: the track scrolls one slide; the row follows.
      await track.evaluate((el) => el.scrollTo({ left: el.clientWidth * 2 }))
      await expect(row.getByRole('button').nth(2)).toHaveAttribute('aria-pressed', 'true')
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('only a framed render: no grid, no row', async ({ page }) => {
    const fx = await renderedWork(false)
    try {
      await page.goto(`/artworks/${fx.slug}`)
      await expect(page.locator('[data-print-presentation]').first()).toBeVisible()
      await expect(tiles(page)).toHaveCount(0)
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
