import { test, expect } from '@playwright/test'

import { PEEK_DURATION_S } from '@/components/ui/TakeAPeek/media'

/**
 * Take a peek (docs/take-a-peek/README.md, T5). The homepage's Fine-art prints shows a small
 * looping circle of a print being unboxed; it opens the full video in a window. The full video
 * (4 MB) must not be requested until the window opens; Escape closes the window and gives focus
 * back to the circle.
 *
 * Needs the homepage's prints section, so at least one rendered print in Admin › Content › Home
 * page prints (the dev database has them).
 */
const FULL_VIDEO = '/videos/take-a-peek/print-arrives-full.mp4'

test('Take a peek: the full video loads only once the window opens, and Escape closes it', async ({
  page,
}) => {
  const fullVideoRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(FULL_VIDEO)) fullVideoRequests.push(request.url())
  })

  await page.goto('/')
  const circle = page.getByRole('button', {
    name: `Take a peek: watch what arrives at your door, ${PEEK_DURATION_S} seconds`,
  })
  await circle.scrollIntoViewIfNeeded()
  await expect(circle).toBeVisible()

  // The circle's own loop plays once on screen; the full video is still untouched.
  await expect(circle.locator('video')).toHaveJSProperty('paused', false)
  expect(fullVideoRequests).toHaveLength(0)

  await circle.click()
  const dialog = page.getByRole('dialog', { name: 'What arrives at your door' })
  await expect(dialog).toBeVisible()
  await expect.poll(() => fullVideoRequests.length).toBeGreaterThan(0)
  // Playing: our own control offers Pause (no native controls).
  await expect(dialog.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(dialog.locator('video')).toHaveJSProperty('controls', false)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(circle).toBeFocused()
})
