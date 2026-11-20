import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'
import { setupLimitedFixture, teardownLimitedFixture } from './edition-helpers'

/**
 * The availability card — the compact block in the artwork page's left column.
 *
 * It must sit ABOVE THE FOLD, so it is deliberately terse: a price, the edition
 * this buyer would receive, and the button. The
 * fuller explanation lives in the band further down the page.
 *
 * It describes exactly ONE configuration — the cheapest live variant, the one
 * the price belongs to — so the figure and the edition can never describe
 * different objects.
 *
 * Flat page: no WebGL.
 */
test.describe('the availability card', () => {
  test('names the price and the copy on offer', async ({ page }) => {
    const fx = await setupLimitedFixture(5)
    try {
      await prisma.artwork.update({
        where: { id: fx.artworkId },
        data: { title: `E2E Card ${fx.slug}` },
      })

      await page.goto(`/artworks/${fx.slug}`)

      // Stated ONCE. A second commerce block below the image used to restate
      // all of this; it was removed because directly under the artwork it read
      // as a stutter rather than a convenience.
      await expect(page.getByText('Available', { exact: true })).toHaveCount(1)
      await expect(page.getByText(/^€[\d.,]+$/).first()).toBeVisible()
      await expect(page.getByText('Limited Edition')).toHaveCount(1)

      // The row states the edition SIZE and makes no claim about copies. "X of
      // Y" is the edition-number convention, so any count in that shape reads
      // as "this is copy X" — which the page cannot honestly promise.
      await expect(page.getByText(/Edition of 5/).first()).toBeVisible()

      // No "Not reserved until you pay" line on the page (owner, 2026-11-20: too
      // pushy). Only the order wizard's limited step still says it.
      await expect(page.getByText(/not reserved until you pay/i)).toHaveCount(0)

      await expect(page.getByRole('button', { name: /order a print/i }).first()).toBeVisible()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })

  test('a work that is not for sale has no card at all', async ({ page }) => {
    const fx = await setupLimitedFixture(5)
    try {
      // Unpublish every variant: the work stays in the catalogue, but nothing
      // about buying it may appear.
      await prisma.limitedVariant.updateMany({
        where: { artworkId: fx.artworkId },
        data: { published: false },
      })

      await page.goto(`/artworks/${fx.slug}`)

      await expect(page.getByText('Available', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /order a print/i })).toHaveCount(0)
      // The work itself is still here, and still enquirable.
      await expect(page.getByRole('button', { name: /inquire/i })).toBeVisible()
    } finally {
      await teardownLimitedFixture(fx)
    }
  })
})
