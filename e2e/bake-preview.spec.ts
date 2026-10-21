import { test, expect } from '@playwright/test'

import type { Prisma } from '@/generated/prisma/client'
import { loadBakeFingerprint } from '@/lib/bake/loadBakeFingerprint'
import { buildExhibitionSnapshot } from '@/lib/exhibitionSnapshot'
import prisma from '@/lib/prisma'

import { bakeRecord } from './bake-helpers'
import { fixtures } from './fixtures'

/**
 * AR-161: the bake preview link. In a baked space a valid token shows the LIVE draft with its
 * draft bake (published or not); visitors without it keep exactly the published exhibition. A
 * draft bake that doesn't match the draft room is reported (`bakeStatus`), never served.
 *
 * API only: no WebGL page loads.
 */

const TOKEN = 'e2e-bake-preview-token'
const LIVE_WALL = '#d0d0d0'
const now = () => new Date().toISOString()
const json = (value: unknown) => value as Prisma.InputJsonValue

type Fixture = {
  spaceId?: string
  published: boolean
  previewEnabled?: boolean
  /** Published snapshot with bake `pub`, then a current draft bake `draft`. */
  draftBake?: boolean
}

const it = test.extend<{ create: (f: Fixture) => Promise<{ id: string; url: string }> }>({
  create: async ({}, provide) => {
    const ids: string[] = []
    try {
      await provide(async (f) => {
        const owner = await prisma.user.findUniqueOrThrow({
          where: { handler: fixtures.artistSlug },
          select: { id: true, handler: true },
        })
        const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
        const ex = await prisma.exhibition.create({
          data: {
            userId: owner.id,
            handler: owner.handler,
            mainTitle: `E2E Bake Preview ${s}`,
            url: `e2e-bake-preview-${s}`,
            spaceId: f.spaceId ?? 'paris',
            status: 'current',
            published: f.published,
            spacePublished: f.published,
            previewEnabled: f.previewEnabled ?? true,
            previewToken: TOKEN,
          },
          select: { id: true, url: true },
        })
        ids.push(ex.id)
        if (f.draftBake) {
          // The visitors' frozen room, with its reviewed bake...
          const pub = bakeRecord('pub', await loadBakeFingerprint(ex.id), now())
          await prisma.exhibition.update({ where: { id: ex.id }, data: { bake: json(pub) } })
          const snapshot = await buildExhibitionSnapshot(ex.id)
          // ...then the artist's draft moves on and is baked again.
          await prisma.exhibition.update({
            where: { id: ex.id },
            data: { publishedSnapshot: json(snapshot), wallColor: LIVE_WALL },
          })
          const draft = bakeRecord('draft', await loadBakeFingerprint(ex.id), null)
          await prisma.exhibition.update({ where: { id: ex.id }, data: { bake: json(draft) } })
        }
        return ex
      })
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: ids } } })
    }
  },
})

const get = async (
  request: import('@playwright/test').APIRequestContext,
  url: string,
  preview?: string,
) => {
  const res = await request.get(
    `/api/exhibitions/by-url/${url}${preview ? `?preview=${preview}` : ''}`,
  )
  return { status: res.status(), headers: res.headers(), body: await res.json() }
}

test.describe('bake preview link', () => {
  it('shows the live draft and its bake; visitors keep the published room', async ({
    request,
    create,
  }) => {
    const { id, url } = await create({ published: true, draftBake: true })

    const pub = await get(request, url)
    expect(pub.body.bake.id).toBe('pub')
    expect(pub.body.wallColor).not.toBe(LIVE_WALL)
    expect(pub.body.bakeStatus).toBeUndefined()

    const pv = await get(request, url, TOKEN)
    expect(pv.status).toBe(200)
    expect(pv.body.bakeStatus).toBe('current')
    expect(pv.body.bake.id).toBe('draft') // reviewed or not: the link is for looking
    expect(pv.body.wallColor).toBe(LIVE_WALL) // draft data, not the snapshot's
    expect(pv.body.previewToken).toBeUndefined()
    expect(pv.body.bakeFingerprint).toBeUndefined()
    expect(pv.body.publishedSnapshot).toBeUndefined()
    expect(JSON.stringify(pv.body)).not.toContain('originalImageUrl')
    expect(pv.headers['cache-control']).toContain('no-cache') // revalidated, never served stale from a shared cache

    // The room moves on: the draft bake no longer matches, so no bake is served.
    await prisma.exhibition.update({ where: { id }, data: { wallColor: '#e0e0e0' } })
    const stale = await get(request, url, TOKEN)
    expect(stale.body.bakeStatus).toBe('stale')
    expect(stale.body.bake).toBeNull()
    expect(stale.body.wallColor).toBe('#e0e0e0')

    // Visitors are still untouched.
    expect((await get(request, url)).body.bake.id).toBe('pub')
    // A wrong token is just a visitor.
    expect((await get(request, url, 'wrong')).body.bake.id).toBe('pub')
  })

  it('an unpublished exhibition: the token opens it, a wrong one does not', async ({
    request,
    create,
  }) => {
    const { url } = await create({ published: false })
    expect((await get(request, url)).status).toBe(404)
    expect((await get(request, url, 'wrong')).status).toBe(404)
    const pv = await get(request, url, TOKEN)
    expect(pv.status).toBe(200)
    expect(pv.body.previewToken).toBeUndefined()
  })

  it('no draft bake is reported as missing', async ({ request, create }) => {
    const { url } = await create({ published: false })
    const pv = await get(request, url, TOKEN)
    expect(pv.body.bakeStatus).toBe('missing')
    expect(pv.body.bake).toBeNull()
  })

  it('a disabled link is ignored', async ({ request, create }) => {
    const live = await create({ published: true, draftBake: true, previewEnabled: false })
    const pv = await get(request, live.url, TOKEN)
    expect(pv.body.bake.id).toBe('pub')
    expect(pv.body.bakeStatus).toBeUndefined()
    const off = await create({ published: false, previewEnabled: false })
    expect((await get(request, off.url, TOKEN)).status).toBe(404)
  })

  it("spaces without baked lighting keep today's preview", async ({ request, create }) => {
    const { url } = await create({ published: false, spaceId: 'london' })
    const pv = await get(request, url, TOKEN)
    expect(pv.status).toBe(200)
    expect(pv.body.bakeStatus).toBeUndefined()
  })
})
