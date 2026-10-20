import { existsSync } from 'fs'
import { rm } from 'fs/promises'
import path from 'path'

import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { bakeBackend, bakeObjectSize, deleteBakeObjects } from '@/lib/bake/bakeStorage'
import { loadBakeFingerprint } from '@/lib/bake/loadBakeFingerprint'
import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * AR-161: an admin starts a bake (fresh id, upload URLs), uploads the maps, then
 * saves the record. Nothing partial: the draft changes only when every map is
 * stored. Runs on whichever backend BAKE_STORAGE selects ('local' | 'r2').
 *
 * Flat API checks: no WebGL, no page loads.
 */

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const CACHE = 'public, max-age=31536000, immutable'

const map = (url: string): BakeRecord['maps'][number] => ({
  receiver: 'wall',
  kind: 'light',
  url,
  width: 1,
  height: 1,
  encoding: { format: 'log16', max: 1, knee: 1 },
})

// What a client sends: a BakeRecord without bakedBy (the server owns it and reviewedAt).
type Sent = Omit<BakeRecord, 'bakedBy'> & { bakedBy?: string }
const record = (id: string, fingerprint: string, urls: string[]): Sent => ({
  id,
  fingerprint,
  bakerVersion: 1,
  unwrapHash: 'hash',
  unwrapStats: [[1, 2, 3, 4, 5]],
  maps: urls.map(map),
  camera: { exposure: 1, whiteBalance: [1, 1, 1] },
  artLight: {},
  bakedAt: '2026-10-19T00:00:00.000Z',
  ms: 1,
  reviewedAt: '2026-01-01T00:00:00.000Z', // the server must reset this
})

test('an admin stores a bake, nothing partial; the artist cannot', async ({
  playwright,
  baseURL,
}) => {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const adminUser = await prisma.user.findFirstOrThrow({
    where: { userType: { in: ['admin', 'superAdmin'] }, email: process.env.E2E_ADMIN_EMAIL },
    select: { id: true },
  })
  // Sweep fixtures a crashed earlier run left behind.
  await prisma.exhibition.deleteMany({ where: { url: { startsWith: 'e2e-bake-api-' } } })
  const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: 'E2E Bake API',
      url: `e2e-bake-api-${s}`,
      spaceId: 'paris',
      status: 'published',
      published: true,
      spacePublished: true,
    },
  })
  const id = exhibition.id
  const other = await prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: 'E2E Bake API other',
      url: `e2e-bake-api-other-${s}`,
      spaceId: 'paris',
      status: 'current',
    },
  })

  const admin = await playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/admin.json',
  })
  const artist = await playwright.request.newContext({
    baseURL,
    storageState: 'e2e/.auth/artist.json',
  })
  const anon = await playwright.request.newContext({ baseURL })
  const started: [string, string][] = []
  const probeFile = path.join(process.cwd(), 'bake-traversal-probe.txt')

  type Started = { bakeId: string; uploads: { file: string; url: string; publicUrl: string }[] }
  const start = async (exhibitionId = id): Promise<Started> => {
    const res = await admin.post(`/api/exhibitions/${exhibitionId}/bake/uploads`, {
      data: { files: ['wall-light.png'] },
    })
    expect(res.status()).toBe(200)
    const body: Started = await res.json()
    started.push([exhibitionId, body.bakeId])
    return body
  }
  const upload = async (u: Started['uploads'][number]) => {
    if (u.url.startsWith('/')) {
      expect((await admin.put(u.url, { data: PNG })).status()).toBe(200)
    } else {
      const res = await fetch(u.url, {
        method: 'PUT',
        body: PNG,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
      })
      expect(res.status).toBe(200)
    }
  }
  const draft = async () => (await prisma.exhibition.findUniqueOrThrow({ where: { id } })).bake
  const save = (ctx: APIRequestContext, data: unknown) =>
    ctx.put(`/api/exhibitions/${id}/bake`, { data })
  const reviewed = (ctx: APIRequestContext, bakeId: unknown) =>
    ctx.post(`/api/exhibitions/${id}/bake/reviewed`, { data: { bakeId } })

  try {
    const fingerprint = await loadBakeFingerprint(id)

    // The artist cannot start, save or review a bake.
    expect(
      (
        await artist.post(`/api/exhibitions/${id}/bake/uploads`, {
          data: { files: ['wall-light.png'] },
        })
      ).status(),
    ).toBe(403)
    expect((await save(artist, record('x', fingerprint, []))).status()).toBe(403)
    expect((await reviewed(artist, 'x')).status()).toBe(403)

    // Bad file lists are refused.
    for (const files of [
      [],
      ['../x.png'],
      ['Wall.png'],
      ['a.png', 'a.png'],
      ['wall.jpg'],
      Array.from({ length: 13 }, (_, i) => `${'a'.repeat(i + 1)}.png`),
      'wall-light.png',
    ]) {
      const res = await admin.post(`/api/exhibitions/${id}/bake/uploads`, { data: { files } })
      expect(res.status(), JSON.stringify(files)).toBe(400)
    }

    // Two bakes never share a key.
    const a = await start()
    const b = await start()
    expect(a.bakeId).not.toBe(b.bakeId)
    // Runner and spawned server agree on the backend (local hands out relative URLs).
    expect(a.uploads[0].url.startsWith('/')).toBe(bakeBackend() === 'local')
    expect(a.uploads[0].publicUrl).toContain(`/exhibitions/${id}/bakes/${a.bakeId}/wall-light.png`)
    expect(a.uploads[0].publicUrl).not.toBe(b.uploads[0].publicUrl)

    // Nothing partial: an object never uploaded is refused and the draft is unchanged.
    const missing = await save(admin, record(a.bakeId, fingerprint, [a.uploads[0].publicUrl]))
    expect(missing.status()).toBe(400)
    expect(await draft()).toBeNull()

    // Upload b. Each case below fails ONLY on the prefix check: the object it names exists.
    await upload(b.uploads[0])
    // (1) another bake's object, saved as bake a: wrong bake folder.
    expect(
      (await save(admin, record(a.bakeId, fingerprint, [b.uploads[0].publicUrl]))).status(),
    ).toBe(400)
    // (2) another exhibition's existing object, saved under the right record id of THAT bake.
    const o = await start(other.id)
    await upload(o.uploads[0])
    expect(await bakeObjectSize(o.uploads[0].publicUrl)).toBe(PNG.length)
    expect(
      (await save(admin, record(o.bakeId, fingerprint, [o.uploads[0].publicUrl]))).status(),
    ).toBe(400)
    // Malformed or foreign URLs (fail for one reason or another; nothing may be written).
    for (const url of [
      'https://evil.example/exhibitions/x/bakes/y/wall-light.png',
      `${b.uploads[0].publicUrl}?x=1`,
      b.uploads[0].publicUrl.replace('wall-light.png', '../wall-light.png'),
    ]) {
      const res = await save(admin, record(b.bakeId, fingerprint, [url]))
      expect(res.status(), url).toBe(400)
    }
    // The same map twice is refused.
    expect(
      (
        await save(
          admin,
          record(b.bakeId, fingerprint, [b.uploads[0].publicUrl, b.uploads[0].publicUrl]),
        )
      ).status(),
    ).toBe(400)
    expect((await save(admin, { not: 'a record' })).status()).toBe(400)
    expect((await save(admin, record('../evil', fingerprint, []))).status()).toBe(400)
    expect(await draft()).toBeNull()

    // Happy path: bake b.
    // A client-supplied bakedBy is ignored: the server uses the session.
    const first = await save(admin, {
      ...record(b.bakeId, fingerprint, [b.uploads[0].publicUrl]),
      bakedBy: 'someone-else',
    })
    expect(first.status()).toBe(200)
    const stored = (await draft()) as unknown as BakeRecord
    expect(stored.id).toBe(b.bakeId)
    expect(stored.bakedBy).toBe(adminUser.id)
    expect(stored.reviewedAt).toBeNull()
    expect(await bakeObjectSize(b.uploads[0].publicUrl)).toBe(PNG.length)
    if (bakeBackend() === 'local') {
      const served = await anon.get(b.uploads[0].publicUrl)
      expect(served.status()).toBe(200)
      expect(served.headers()['content-type']).toBe('image/png')
      expect(served.headers()['cache-control']).toBe(CACHE)
      expect(Buffer.compare(await served.body(), PNG)).toBe(0)
      // The local file server is admin-only to write and rejects traversal.
      expect((await anon.put(a.uploads[0].url, { data: PNG })).status()).toBe(401)
      expect((await artist.put(a.uploads[0].url, { data: PNG })).status()).toBe(403)
      // The traversal is encoded inside ONE segment so the client does not normalize it away.
      // Unvalidated, it would resolve to the repo's package.json / a file in the repo root.
      const up = '..%2F..%2F..%2F'
      for (const bad of [
        `/api/bake-files/exhibitions/${id}/bakes/${b.bakeId}/${up}package.json`,
        `/api/bake-files/exhibitions/${id}/bakes/${b.bakeId}/${up}bake-traversal-probe.txt`,
        `/api/bake-files/exhibitions/${up}/bakes/${b.bakeId}/wall-light.png`,
        `/api/bake-files/exhibitions/${id}/bakes/${up}/wall-light.png`,
        `/api/bake-files/exhibitions/${id}/bakes/${b.bakeId}/wall-light.png/x`,
        `/api/bake-files/exhibitions/${id}/bakes/${b.bakeId}/%5Cwall.png`,
      ]) {
        expect((await anon.get(bad)).status(), bad).toBe(404)
        expect((await admin.put(bad, { data: PNG })).status(), bad).toBe(400)
      }
      expect(existsSync(probeFile)).toBe(false)
    }

    // Reviewed: wrong id and stale fingerprint are 409; the right pair stamps it.
    expect((await reviewed(admin, a.bakeId)).status()).toBe(409)
    expect((await reviewed(admin, 123)).status()).toBe(400)
    expect(((await draft()) as unknown as BakeRecord).reviewedAt).toBeNull()
    expect((await reviewed(admin, b.bakeId)).status()).toBe(200)
    expect(((await draft()) as unknown as BakeRecord).reviewedAt).not.toBeNull()

    // A second successful bake replaces the draft and deletes the first one's objects.
    const c = await start()
    await upload(c.uploads[0])
    expect(
      (await save(admin, record(c.bakeId, 'stale-fingerprint', [c.uploads[0].publicUrl]))).status(),
    ).toBe(200)
    expect(((await draft()) as unknown as BakeRecord).id).toBe(c.bakeId)
    expect(await bakeObjectSize(b.uploads[0].publicUrl)).toBeNull()
    expect(await bakeObjectSize(c.uploads[0].publicUrl)).toBe(PNG.length)
    // ... and a bake of a room that has since changed cannot be marked reviewed.
    expect((await reviewed(admin, c.bakeId)).status()).toBe(409)
    expect(((await draft()) as unknown as BakeRecord).reviewedAt).toBeNull()

    // The previous draft is kept when it is the published bake.
    await prisma.exhibition.update({
      where: { id },
      data: { publishedSnapshot: { exhibition: { spaceId: 'paris', bake: { id: c.bakeId } } } },
    })
    const d = await start()
    await upload(d.uploads[0])
    expect(
      (await save(admin, record(d.bakeId, fingerprint, [d.uploads[0].publicUrl]))).status(),
    ).toBe(200)
    expect(await bakeObjectSize(c.uploads[0].publicUrl)).toBe(PNG.length)
  } finally {
    await Promise.all([anon.dispose(), admin.dispose(), artist.dispose()])
    for (const [exhibitionId, bakeId] of started) {
      await deleteBakeObjects(exhibitionId, bakeId).catch(() => {})
    }
    await rm(probeFile, { force: true })
    await prisma.exhibition.deleteMany({ where: { id: { in: [id, other.id] } } })
  }
})
