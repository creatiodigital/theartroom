import { test, expect } from '@playwright/test'

import { fixtures } from './fixtures'

/**
 * Virtual exhibition canvas renders.
 *
 * Click into a published exhibition, click "Enter Virtual Exhibition",
 * confirm the immersive 3D scene's <canvas> mounts and that no
 * uncaught console errors fire while it boots. Catches regressions
 * in the React-Three-Fiber Scene + space loader pipeline (a broken
 * Scene leaves the visit page blank and silently kills the buyer's
 * way to browse art).
 *
 * Read-only.
 */

test('exhibition: enter virtual exhibition renders the 3D canvas', async ({ page }) => {
  test.setTimeout(60_000)

  // Track console errors during the visit. WebGL warnings (which can
  // be noisy / environment-dependent) are filtered out — we want to
  // catch genuine JS errors only.
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (/WebGL|context lost|three\.js|Three\.js/i.test(text)) return
    errors.push(`console.error: ${text}`)
  })

  // Open the exhibition profile page.
  const profileUrl = `/exhibitions/${fixtures.artistSlug}/${fixtures.exhibitionSlug}`
  const res = await page.goto(profileUrl)
  expect(res?.status(), 'exhibition profile should respond 2xx').toBeLessThan(400)

  // Click the "Enter Virtual Exhibition" CTA. The component renders
  // it as a Button that links to /visit.
  const enterCta = page.getByRole('link', { name: /enter virtual exhibition/i })
  await expect(enterCta, '"Enter Virtual Exhibition" CTA should be visible').toBeVisible({
    timeout: 15_000,
  })
  await enterCta.click()

  // Land on /visit.
  await page.waitForURL(`**${profileUrl}/visit`, { timeout: 15_000 })

  // The Scene component mounts a R3F <Canvas>, which renders a real
  // <canvas> element inside the page. Wait for it.
  const canvas = page.locator('canvas')
  await expect(canvas.first(), 'a <canvas> element should appear').toBeVisible({
    timeout: 30_000,
  })

  // Asset preloading is async; give the scene a moment to boot before
  // we declare it healthy.
  await page.waitForTimeout(1500)

  expect(errors, `unexpected JS errors during 3D scene boot:\n${errors.join('\n')}`).toEqual([])
})
