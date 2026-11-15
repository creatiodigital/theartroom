import { devices, expect, test, type Browser, type Page } from '@playwright/test'

import { showIn, visitRoom, type Visit } from './helpers'

/**
 * AR-183 Lightbox (docs/lightbox §6: "must stay smooth on phones"). The Vienna room on a phone
 * (an iPhone's screen, touch, its pixel ratio), twice: as it is, then with EVERY image shown as a
 * Bright, glossy lightbox — the heaviest case: its front's shader, the box, and the wall glow for
 * each (no bake has them). The frame rate holds, and nothing errors.
 *
 * Read-only: the room's answer is changed in this browser only (nothing is saved). Real GPU, as
 * the rest of this suite; the phone is emulated (screen, touch, pixel ratio), its GPU is not.
 */
const iPhone = devices['iPhone 13']
const phone = {
  viewport: iPhone.viewport,
  deviceScaleFactor: iPhone.deviceScaleFactor,
  isMobile: iPhone.isMobile,
  hasTouch: iPhone.hasTouch,
  userAgent: iPhone.userAgent,
}

const LIGHTBOX = {
  showLightbox: true,
  lightboxBrightness: 1,
  lightboxLight: 'neutral',
  lightboxDepth: 6,
  lightboxEdge: 'thin',
  lightboxMaterial: 'alu-black',
  lightboxFront: 'glossy',
}

/** Every image row of the room's answer, as a lightbox; how many. */
const asLightboxes = (node: unknown): number => {
  if (Array.isArray(node)) return node.reduce((n: number, item) => n + asLightboxes(item), 0)
  if (!node || typeof node !== 'object') return 0
  const row = node as Record<string, unknown>
  let count = 0
  const artwork = row.artwork as Record<string, unknown> | undefined
  if (row.artworkId && artwork?.artworkType === 'image' && row.wallId) {
    Object.assign(row, LIGHTBOX)
    count++
  }
  for (const value of Object.values(row)) count += asLightboxes(value)
  return count
}

/** Frames per second the page draws over `ms`, the room standing still. */
const frameRate = (page: Page, ms = 5_000) =>
  page.evaluate(
    (ms) =>
      new Promise<number>((resolve) => {
        let frames = 0
        const start = performance.now()
        const tick = () => {
          frames++
          const elapsed = performance.now() - start
          if (elapsed < ms) requestAnimationFrame(tick)
          else resolve((frames * 1000) / elapsed)
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )

const visitOnPhone = async (browser: Browser, lightboxes: boolean) => {
  const show = await showIn('vienna')
  const context = await browser.newContext({ ...phone, baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  let shown = 0
  if (lightboxes)
    await page.route('**/api/exhibitions/by-url/**', async (route) => {
      const response = await route.fetch()
      const json = await response.json()
      shown += asLightboxes(json)
      await route.fulfill({ response, body: JSON.stringify(json) })
    })
  const visit: Visit = await visitRoom(page, show)
  // The room settles (late textures, the first frames' compiles) before it is timed.
  await page.waitForTimeout(3_000)
  return { visit, shown, fps: await frameRate(page), close: () => context.close() }
}

test.describe('a room of lightboxes on a phone', () => {
  test.describe.configure({ mode: 'serial' })

  test('every image a Bright, glossy lightbox: the frame rate holds, nothing errors', async ({
    browser,
  }) => {
    // Two cold visits of the room (the suite's 240 s is one).
    test.setTimeout(600_000)
    const plain = await visitOnPhone(browser, false)
    await plain.close()
    const lit = await visitOnPhone(browser, true)
    try {
      console.log(
        `vienna on a phone: ${plain.fps.toFixed(1)} fps as it is, ${lit.fps.toFixed(1)} fps with ` +
          `${lit.shown} lightboxes`,
      )
      expect(lit.shown, 'no image was turned into a lightbox').toBeGreaterThan(0)
      expect(lit.visit.revealed, `the room was never revealed: ${lit.visit.revealed}`).toBe(true)
      expect(lit.visit.pageErrors, 'uncaught errors in the page').toEqual([])
      expect(lit.visit.consoleErrors, 'errors in the console').toEqual([])
      expect(lit.fps, 'the lightboxes cost frames').toBeGreaterThanOrEqual(plain.fps * 0.9)
    } finally {
      await lit.close()
    }
  })
})
