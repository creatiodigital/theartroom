import { test, expect } from '@playwright/test'

import { shotFacts, shownRecord } from '@/lib/printPresentation/currentInputs'
import { shotFrame } from '@/lib/printPresentation/geometry'
import { makeLook } from '@/lib/printPresentation/look'
import { presentationFingerprint, presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import {
  isPrintPresentationRecord,
  type PrintPresentationRecord,
} from '@/lib/printPresentation/record'
import { deletePresentationFiles, presentationPublicUrls } from '@/lib/printPresentation/storage'
import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * Print presentations: the admin's browser stores a render — upload URLs for both sizes, the two
 * WebP files, then the record. The server builds the record itself (clients never send URLs),
 * refuses a render of an out-of-date fingerprint, and saves nothing before both files are stored.
 * Runs on whichever backend BAKE_STORAGE selects ('local' in development).
 *
 * On its own temporary artwork: a stored render's file names come from the work's fingerprint,
 * so testing on a real work would collide with — and clean up — its real render.
 *
 * Flat API checks: no WebGL, no page loads.
 */

// 1×1 transparent WebP.
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64')
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000'
const WINDOW = { x: 0.135, y: 0.177, w: 0.73, h: 0.622 }

test.describe.configure({ mode: 'serial' })

test('an admin stores a print presentation; nothing partial, nothing out of date', async ({
  playwright,
  baseURL,
}) => {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true },
  })
  // Sweep what a crashed earlier run left behind.
  await prisma.artwork.deleteMany({ where: { slug: { startsWith: 'e2e-presentation-api-' } } })
  const artwork = await prisma.artwork.create({
    data: {
      userId: owner.id,
      name: 'E2E Presentation API',
      slug: `e2e-presentation-api-${Date.now()}`,
      artworkType: 'image',
      originalWidth: 3000,
      originalHeight: 2000,
    },
    select: { id: true },
  })
  const id = artwork.id
  const [source] = await loadPresentationSources({ ids: [id] })
  const inputs = presentationInputs(source)
  expect(inputs, 'the fixture artwork must be an image with known dimensions').not.toBeNull()
  const fingerprint = inputs!.fingerprint

  const admin = await playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/admin.json',
  })
  const artist = await playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/artist.json',
  })
  const anon = await playwright.request.newContext({ baseURL })
  const uploadsUrl = `/api/admin/print-presentations/${id}/uploads`
  const recordUrl = `/api/admin/print-presentations/${id}`

  try {
    // Only admins.
    expect((await anon.post(uploadsUrl, { data: { fingerprint } })).status()).toBe(401)
    expect((await artist.post(uploadsUrl, { data: { fingerprint } })).status()).toBe(403)
    expect((await artist.put(recordUrl, { data: { fingerprint, window: WINDOW } })).status()).toBe(
      403,
    )

    // A render of an out-of-date look, or of an unknown work, is refused.
    expect((await admin.post(uploadsUrl, { data: { fingerprint: 'nope' } })).status()).toBe(409)
    expect(
      (
        await admin.post(`/api/admin/print-presentations/${UNKNOWN_ID}/uploads`, {
          data: { fingerprint },
        })
      ).status(),
    ).toBe(404)

    // Two sizes, named by the fingerprint.
    const res = await admin.post(uploadsUrl, { data: { fingerprint } })
    expect(res.status()).toBe(200)
    const uploads = (await res.json()) as Record<
      'large' | 'small',
      { url: string; publicUrl: string }
    >
    expect(uploads.large.publicUrl).toMatch(new RegExp(`${fingerprint}-1800\\.webp$`))
    expect(uploads.small.publicUrl).toMatch(new RegExp(`${fingerprint}-900\\.webp$`))

    // Nothing is saved before both files are stored.
    expect((await admin.put(recordUrl, { data: { fingerprint, window: WINDOW } })).status()).toBe(
      400,
    )

    for (const size of ['large', 'small'] as const) {
      const put = await admin.put(uploads[size].url, {
        data: WEBP,
        headers: { 'Content-Type': 'image/webp' },
      })
      expect(put.status(), size).toBe(200)
    }

    // A window outside the shot, a stale fingerprint, an unknown work: refused.
    expect(
      (
        await admin.put(recordUrl, { data: { fingerprint, window: { ...WINDOW, x: 1.2 } } })
      ).status(),
    ).toBe(400)
    expect(
      (await admin.put(recordUrl, { data: { fingerprint: 'nope', window: WINDOW } })).status(),
    ).toBe(409)
    expect(
      (
        await admin.put(`/api/admin/print-presentations/${UNKNOWN_ID}`, {
          data: { fingerprint, window: WINDOW },
        })
      ).status(),
    ).toBe(404)

    // The record: built by the server, URLs of this fingerprint, window as sent.
    const saved = await admin.put(recordUrl, {
      data: { fingerprint, window: WINDOW, urls: { large: 'https://evil.example/x.webp' } },
    })
    expect(saved.status()).toBe(200)
    const row = await prisma.artwork.findUniqueOrThrow({
      where: { id },
      select: { printPresentation: true },
    })
    expect(isPrintPresentationRecord(row.printPresentation)).toBe(true)
    const record = row.printPresentation as { urls: Record<string, string>; window: object }
    expect(record.urls.large).toBe(uploads.large.publicUrl)
    expect(record.urls.small).toBe(uploads.small.publicUrl)
    expect(record.window).toEqual(WINDOW)
    // What the shot shows, so pages can still place it once the work's settings move on.
    expect(record).toMatchObject({
      frame: inputs!.frame ?? 'none',
      passepartout: inputs!.passepartout,
      ratio: inputs!.ratio,
    })
    // The shot's shape, computed by the server from the look (the large render's pixels).
    const shot = shotFrame(
      inputs!.mode,
      inputs!.ratio,
      1800,
      makeLook(inputs!.seed, inputs!.mode, inputs!.edition ?? 1),
    )
    expect((record as unknown as { aspect: number }).aspect).toBeCloseTo(
      shot.widthPx / shot.heightPx,
      9,
    )

    // The stored files are served as WebP.
    const served = await admin.get(uploads.small.publicUrl)
    expect(served.status()).toBe(200)
    expect(served.headers()['content-type']).toBe('image/webp')
  } finally {
    const row = await prisma.artwork.findUniqueOrThrow({
      where: { id },
      select: { printPresentation: true },
    })
    if (isPrintPresentationRecord(row.printPresentation)) {
      await deletePresentationFiles(row.printPresentation, id)
    }
    await prisma.artwork.delete({ where: { id } })
  }
})

test('a record must be well formed', () => {
  const good = {
    fingerprint: 'abc',
    mode: 'framed',
    edition: null,
    window: WINDOW,
    aspect: 1.28,
    urls: { large: '/a-1800.webp', small: '/a-900.webp' },
    renderedAt: '2026-10-28T00:00:00.000Z',
  }
  expect(isPrintPresentationRecord(good)).toBe(true)
  expect(isPrintPresentationRecord({ ...good, urls: { small: '/a-900.webp' } })).toBe(false)
  expect(isPrintPresentationRecord({ ...good, window: { ...WINDOW, x: Number.NaN } })).toBe(false)
  expect(isPrintPresentationRecord({ ...good, window: { ...WINDOW, w: 1.5 } })).toBe(false)
  expect(isPrintPresentationRecord({ ...good, mode: 'poster' })).toBe(false)
  expect(isPrintPresentationRecord({ ...good, aspect: 0 })).toBe(false)
  expect(isPrintPresentationRecord(null)).toBe(false)
  // What the shot shows: optional (renders saved before 2026-11-03 don't say), valid if there.
  const told = { ...good, frame: 'wood-light', passepartout: true, ratio: 1.5 }
  expect(isPrintPresentationRecord(told)).toBe(true)
  expect(isPrintPresentationRecord({ ...told, frame: 'none' })).toBe(true)
  expect(isPrintPresentationRecord({ ...told, frame: 'gold' })).toBe(false)
  expect(isPrintPresentationRecord({ ...told, passepartout: 'yes' })).toBe(false)
  expect(isPrintPresentationRecord({ ...told, ratio: -1 })).toBe(false)
})

test.describe('the render a page shows', () => {
  const id = '683e76c1-2c50-4ed0-93d1-444fa8edef7f'
  const inputs = presentationInputs({
    id,
    artworkType: 'image',
    originalWidth: 6240,
    originalHeight: 4160,
    printEnabled: true,
    editionType: 'open',
    firstVariantEditionSize: null,
    presentationFrame: 'wood-dark',
    presentationPassepartout: false,
    presentationRatio: null,
  })!
  /** A stored render of this 3:2 work, at its own file names; its window has the image's shape. */
  const recordOf = (
    fingerprint: string,
    patch: Partial<PrintPresentationRecord> = {},
  ): PrintPresentationRecord => ({
    fingerprint,
    mode: inputs.mode,
    edition: inputs.edition,
    window: { x: 0.2, y: 0.3, w: 0.6, h: 0.4 },
    aspect: 1,
    urls: presentationPublicUrls(id, fingerprint),
    renderedAt: '2026-11-03T00:00:00.000Z',
    ...patch,
  })

  test('an up-to-date render, as the shot the work is now', () => {
    expect(shownRecord(id, recordOf(inputs.fingerprint), inputs)).toEqual({
      frame: 'wood-dark',
      ratio: 1.5,
    })
  })

  test('an out-of-date render stays up, placed as the shot it is', () => {
    const before = recordOf('deadbeef', { frame: 'none', passepartout: false, ratio: 1.5 })
    expect(shownRecord(id, before, inputs)).toEqual({ frame: null, ratio: 1.5 })
  })

  test('one saved before records said their shot: only when its frame can be told for sure', () => {
    // Rendered in black, the work since switched to dark wood: its fingerprint says black.
    const black = presentationFingerprint({ ...inputs, frame: 'painted-black' })
    expect(shownRecord(id, recordOf(black), inputs)).toEqual({ frame: 'painted-black', ratio: 1.5 })
    const sheet = presentationFingerprint({ ...inputs, frame: null })
    expect(shownRecord(id, recordOf(sheet), inputs)).toEqual({ frame: null, ratio: 1.5 })
    // Out of date for anything else (another look, another shape): not shown, as before.
    expect(shownRecord(id, recordOf('deadbeef'), inputs)).toBe(null)
  })

  test('not when it would show the work wrongly, or lives on another backend', () => {
    // Another edition: a wrong pencilled number.
    const rendered = { frame: 'wood-dark' as const, passepartout: false, ratio: 1.5 }
    const limited = { ...rendered, mode: 'limited' as const, edition: 30 }
    expect(shownRecord(id, recordOf('deadbeef', limited), inputs)).toBe(null)
    // Another shape: the original would no longer fill the window.
    expect(shownRecord(id, recordOf('deadbeef', { ...rendered, ratio: 1.25 }), inputs)).toBe(null)
    // Files this deployment can't serve, current or not.
    const elsewhere = { large: '/elsewhere/x-1800.webp', small: '/elsewhere/x-900.webp' }
    expect(shownRecord(id, recordOf(inputs.fingerprint, { urls: elsewhere }), inputs)).toBe(null)
  })

  test("before a setting changes, a current render that doesn't say its shot gets it written in", () => {
    expect(shotFacts(id, recordOf(inputs.fingerprint), inputs)).toMatchObject({
      frame: 'wood-dark',
      passepartout: false,
      ratio: 1.5,
    })
    // Already says it, or out of date (no telling what it shows): left as it is.
    expect(shotFacts(id, recordOf(inputs.fingerprint, { frame: 'wood-dark' }), inputs)).toBe(null)
    expect(shotFacts(id, recordOf('deadbeef'), inputs)).toBe(null)
  })
})
