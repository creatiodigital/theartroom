import { test, expect } from '@playwright/test'

import { shotFrame } from '@/lib/printPresentation/geometry'
import { makeLook } from '@/lib/printPresentation/look'
import { presentationInputs } from '@/lib/printPresentation/inputs'
import { loadPresentationSources } from '@/lib/printPresentation/loadSources'
import { isPrintPresentationRecord } from '@/lib/printPresentation/record'
import { deletePresentationFiles } from '@/lib/printPresentation/storage'
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
})
