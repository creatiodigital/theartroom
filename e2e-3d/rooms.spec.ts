import sharp from 'sharp'

import { expect, test, type Page } from '@playwright/test'

import { missingFiles, repeatedFiles, showIn, spaceKeys, visitRoom, type Visit } from './helpers'

/**
 * Every 3D space, opened by a first-time visitor (cold: nothing cached) on a real published show,
 * then looked at four ways. One visit per space: a room is tens of megabytes to load.
 *
 * Why this suite exists (2026-11-10): Next 16.4 changed how `next/dynamic` loads a space, the
 * 3D library's renderer could not follow, and every exhibition visit crashed — on a branch whose
 * whole e2e suite was green, because no spec ever opened a room.
 */
for (const space of spaceKeys()) {
  test.describe(`the ${space} room`, () => {
    test.describe.configure({ mode: 'serial' })

    let visit: Visit

    test.beforeAll(async ({ browser }) => {
      const show = await showIn(space)
      const page: Page = await browser.newPage({ baseURL: test.info().project.use.baseURL })
      visit = await visitRoom(page, show)
      const shownIn =
        visit.revealedAfterMs === null
          ? 'NOT revealed'
          : `revealed in ${(visit.revealedAfterMs / 1000).toFixed(1)} s`
      console.log(
        `${space}: "${show.title}" (${show.works} works) ${shownIn}, ${visit.files.length} files asked for`,
      )
    })

    test.afterAll(async () => {
      await visit?.page.close()
    })

    test('loads: the room is revealed, with no error', async () => {
      expect(visit.revealed, `the room was never revealed: ${visit.revealed}`).toBe(true)
      await expect(
        visit.page.getByRole('heading', { name: /couldn.t load|could not be loaded/i }),
        'the scene crashed and showed its error message',
      ).toHaveCount(0)
      expect(visit.pageErrors, 'uncaught errors in the page').toEqual([])
      expect(visit.consoleErrors, 'errors in the console').toEqual([])
    })

    test('shows a room, not a blank canvas', async () => {
      // The canvas alone: anything drawn over it (help, buttons) hidden for the shot, so text
      // over a blank canvas can't pass for a room. A test stylesheet, never the app's.
      const shot = await visit.page.locator('canvas').first().screenshot({
        style:
          'body *:not(canvas) { visibility: hidden !important } canvas { visibility: visible !important }',
      })
      const { channels } = await sharp(shot).stats()
      // A flat fill (blank white, all black) has ~0 spread; walls, floor and works have plenty.
      const spread = Math.max(...channels.slice(0, 3).map((c) => c.stdev))
      expect(spread, 'the canvas is one flat color: nothing was drawn').toBeGreaterThan(8)
    })

    test('asks for each file once', async () => {
      test.skip(
        process.env.E2E_3D_DEV === 'true',
        'dev runs every effect twice (StrictMode): only a production build says this',
      )
      expect(repeatedFiles(visit.files), 'files asked for more than once').toEqual([])
    })

    test('every file it asks for arrives', async () => {
      expect(visit.files.length, 'the room asked for no files at all').toBeGreaterThan(0)
      expect(missingFiles(visit.files), 'files that never arrived').toEqual([])
    })
  })
}
