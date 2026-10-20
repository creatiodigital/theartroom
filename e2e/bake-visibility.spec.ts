import { test, expect } from '@playwright/test'

import { Prisma } from '@/generated/prisma/client'
import { isBakeRecord } from '@/lib/bake/bakeRecord'
import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { loadBakeFingerprint } from '@/lib/bake/loadBakeFingerprint'
import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * AR-161: the draft bake is the owner's work in progress; the published one
 * travels in `publishedSnapshot`. A visitor must never receive the draft, and
 * only an admin sees the room's current fingerprint (edit mode).
 *
 * Flat API checks: no WebGL, no /visit or /edit page.
 */

const bake = (id: string): BakeRecord => ({
  id,
  fingerprint: `fp-${id}`,
  bakerVersion: 1,
  unwrapHash: 'hash',
  unwrapStats: [[1, 2, 3, 4, 5]],
  maps: [],
  camera: { exposure: 1, whiteBalance: [1, 1, 1] },
  artLight: {},
  bakedAt: '2026-10-19T00:00:00.000Z',
  bakedBy: 'e2e',
  ms: 1,
  reviewedAt: null,
})

test('the fixture bakes are valid records', () => {
  expect(isBakeRecord(bake('pub'))).toBe(true)
})

test.describe('who sees which bake', () => {
  test('visitors get the published bake, owner and admin get the draft, only admin gets the fingerprint', async ({
    playwright,
    baseURL,
  }) => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { handler: fixtures.artistSlug },
      select: { id: true, handler: true },
    })
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    const url = `e2e-bake-visibility-${s}`
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: 'E2E Bake Visibility',
        url,
        spaceId: 'paris',
        status: 'published',
        published: true,
        spacePublished: true,
        bake: bake('draft'),
        publishedSnapshot: { exhibition: { spaceId: 'paris', bake: bake('pub') }, artworks: [] },
      },
    })

    const anon = await playwright.request.newContext({ baseURL })
    const admin = await playwright.request.newContext({
      baseURL,
      storageState: 'e2e/.auth/admin.json',
    })
    const artist = await playwright.request.newContext({
      baseURL,
      storageState: 'e2e/.auth/artist.json',
    })

    try {
      const visitor = await anon.get(`/api/exhibitions/by-url/${url}`).then((r) => r.json())
      expect(visitor.bake.id).toBe('pub')
      expect(visitor.bakeFingerprint).toBeUndefined()

      const adminEdit = await admin
        .get(`/api/exhibitions/by-url/${url}?mode=edit`)
        .then((r) => r.json())
      expect(adminEdit.bake.id).toBe('draft')
      expect(adminEdit.bakeFingerprint).toBe(await loadBakeFingerprint(exhibition.id))

      const artistEdit = await artist
        .get(`/api/exhibitions/by-url/${url}?mode=edit`)
        .then((r) => r.json())
      expect(artistEdit.bake.id).toBe('draft')
      expect(artistEdit.bakeFingerprint).toBeUndefined()

      // The read by id: the draft bake only for the owner and admins.
      const byId = `/api/exhibitions/${exhibition.id}`
      const anonRes = await anon.get(byId)
      expect(anonRes.status()).toBe(200)
      const anonBody = await anonRes.json()
      expect(anonBody.mainTitle).toBe('E2E Bake Visibility')
      expect(anonBody.bake, 'the draft bake must never reach a visitor').toBeUndefined()
      expect(JSON.stringify(anonBody)).not.toContain('fp-draft')
      expect((await admin.get(byId).then((r) => r.json())).bake.id).toBe('draft')
      expect((await artist.get(byId).then((r) => r.json())).bake.id).toBe('draft')

      // A published exhibition with no snapshot (legacy) has no published bake.
      await prisma.exhibition.update({
        where: { id: exhibition.id },
        data: { publishedSnapshot: Prisma.DbNull },
      })
      const legacy = await anon.get(`/api/exhibitions/by-url/${url}`).then((r) => r.json())
      expect(legacy.bake).toBeNull()
    } finally {
      await Promise.all([anon.dispose(), admin.dispose(), artist.dispose()])
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
    }
  })
})
