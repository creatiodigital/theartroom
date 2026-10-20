import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import type { Prisma } from '@/generated/prisma/client'
import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { bakeObjectSize, deleteBakeObjects } from '@/lib/bake/bakeStorage'
import { loadBakeFingerprint } from '@/lib/bake/loadBakeFingerprint'
import { bakeGateError } from '@/lib/bake/publishGate'
import { buildExhibitionSnapshot } from '@/lib/exhibitionSnapshot'
import { exhibitionUpdateRoles } from '@/lib/exhibitionUpdateRoles'
import prisma from '@/lib/prisma'

import { bakeRecord } from './bake-helpers'
import { fixtures } from './fixtures'

/**
 * AR-161: in a baked space the server shows a room to visitors only with a bake that
 * matches the room as it stands AND that an admin reviewed. Publishing is the admin's
 * call (server-enforced); the artist keeps editing. Page-only publishes and spaces
 * without baked lighting keep today's behaviour.
 *
 * API checks plus one flat page (the admin exhibitions list): no WebGL.
 */

const PREFIX = 'e2e-bake-gate-'
const ADMIN = 'e2e/.auth/admin.json'
const ARTIST = 'e2e/.auth/artist.json'
const MESSAGES = {
  BAKE_REQUIRED: 'Bake the room before publishing it.',
  BAKE_STALE: 'The room changed since the last bake — bake it again.',
  BAKE_UNREVIEWED: 'Open the baked room to review it before publishing.',
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const CACHE = 'public, max-age=31536000, immutable'

const now = () => new Date().toISOString()
const json = (value: unknown) => value as Prisma.InputJsonValue

type Snapshot = { exhibition: Record<string, unknown> & { bake: { id: string } | null } }

const stamp = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

type Fixture = {
  tag: string
  spaceId?: string
  published: boolean
  spacePublished: boolean
  previewEnabled?: boolean
  bake?: BakeRecord
  publishedSnapshot?: unknown
}

async function createExhibition(f: Fixture) {
  const owner = await fixtureOwner()
  const s = stamp()
  return prisma.exhibition.create({
    data: {
      userId: owner.id,
      handler: owner.handler,
      mainTitle: `E2E Bake Gate ${f.tag} ${s}`,
      url: `${PREFIX}${f.tag}-${s}`,
      spaceId: f.spaceId ?? 'paris',
      status: 'current',
      published: f.published,
      spacePublished: f.spacePublished,
      previewEnabled: f.previewEnabled ?? false,
      previewToken: f.previewEnabled ? `e2e-token-${s}` : null,
      ...(f.bake && { bake: json(f.bake) }),
      ...(f.publishedSnapshot !== undefined && { publishedSnapshot: json(f.publishedSnapshot) }),
    },
    select: { id: true, url: true, mainTitle: true, handler: true },
  })
}

/** Everything a publish may write: a refused one must leave all of it untouched. */
const publishState = (id: string) =>
  prisma.exhibition.findUniqueOrThrow({
    where: { id },
    select: {
      published: true,
      spacePublished: true,
      publishedSnapshot: true,
      publishedAt: true,
      hasPendingChanges: true,
      previewEnabled: true,
      previewToken: true,
      bake: true,
      wallColor: true,
      updatedAt: true,
    },
  })

const setBake = (id: string, bake: BakeRecord) =>
  prisma.exhibition.update({ where: { id }, data: { bake: json(bake) } })

const snapshotOf = async (id: string) =>
  (await publishState(id)).publishedSnapshot as unknown as Snapshot | null

async function expectRefused(
  ctx: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
  error: keyof typeof MESSAGES,
) {
  const before = await publishState(id)
  const res = await ctx.put(`/api/exhibitions/${id}`, { data })
  expect(res.status(), `${JSON.stringify(data)} → ${await res.text()}`).toBe(409)
  expect(await res.json()).toEqual({ error, message: MESSAGES[error] })
  expect(await publishState(id), 'a refused publish writes nothing').toEqual(before)
}

async function expectOk(ctx: APIRequestContext, id: string, data: Record<string, unknown>) {
  const res = await ctx.put(`/api/exhibitions/${id}`, { data })
  expect(res.status(), `${JSON.stringify(data)} → ${await res.text()}`).toBe(200)
}

test.beforeAll(async () => {
  // Sweep fixtures a crashed earlier run left behind.
  await prisma.exhibition.deleteMany({ where: { url: { startsWith: PREFIX } } })
})

test('only paris, vienna and madrid are baked spaces', () => {
  for (const space of ['paris', 'vienna', 'madrid']) expect(isBakedSpace(space)).toBe(true)
  for (const space of ['e2e-unbaked', '', null, undefined]) expect(isBakedSpace(space)).toBe(false)
})

test('a stale bake is refused as stale even when unreviewed', () => {
  expect(bakeGateError(null, 'fp')).toBe('BAKE_REQUIRED')
  expect(bakeGateError({ id: 'not a record' }, 'fp')).toBe('BAKE_REQUIRED')
  expect(bakeGateError(bakeRecord('b', 'old', null), 'fp')).toBe('BAKE_STALE')
  expect(bakeGateError(bakeRecord('b', 'fp', null), 'fp')).toBe('BAKE_UNREVIEWED')
  expect(bakeGateError(bakeRecord('b', 'fp', now()), 'fp')).toBeNull()
})

// The e2e suite has one admin login (no plain, non-super admin), so the role decision is
// checked here, and the requests below check how each role is enforced.
test('publish keys need an admin, other keys the owner, and a body mixing both needs both', () => {
  const admin = { admin: true, owner: false }
  const owner = { admin: false, owner: true }
  const both = { admin: true, owner: true }
  expect(exhibitionUpdateRoles({ published: true })).toEqual(admin)
  expect(exhibitionUpdateRoles({ published: false })).toEqual(admin)
  expect(exhibitionUpdateRoles({ spacePublished: true })).toEqual(admin)
  expect(exhibitionUpdateRoles({ previewEnabled: false })).toEqual(admin)
  expect(exhibitionUpdateRoles({ hasPendingChanges: false })).toEqual(admin)
  expect(exhibitionUpdateRoles({ wallColor: '#ffffff' })).toEqual(owner)
  expect(exhibitionUpdateRoles({ hasPendingChanges: true })).toEqual(owner)
  expect(exhibitionUpdateRoles({})).toEqual(owner)
  expect(exhibitionUpdateRoles({ previewEnabled: false, url: 'x', mainTitle: 'x' })).toEqual(both)
  expect(exhibitionUpdateRoles({ hasPendingChanges: false, wallColor: '#ffffff' })).toEqual(both)
  expect(exhibitionUpdateRoles({ published: true, hasPendingChanges: true })).toEqual(both)
})

// The one snapshot builder: the PUT route and POST /api/admin/migrate-snapshots both freeze
// with it. That route is not called here: it migrates every published exhibition without a
// snapshot in the shared dev DB, not just this spec's fixtures.
test('a frozen snapshot carries a baked space’s draft bake only when it is current and reviewed', async () => {
  const created: string[] = []
  const make = async (tag: string, spaceId = 'paris') => {
    const ex = await createExhibition({ tag, spaceId, published: true, spacePublished: true })
    created.push(ex.id)
    return ex.id
  }
  const frozenBakeId = async (id: string) =>
    ((await buildExhibitionSnapshot(id)).exhibition.bake as { id?: string } | null)?.id ?? null
  try {
    const unreviewed = await make('freeze-unreviewed')
    await setBake(unreviewed, bakeRecord('unreviewed', await loadBakeFingerprint(unreviewed), null))
    const stale = await make('freeze-stale')
    await setBake(stale, bakeRecord('stale', 'fp-old', now()))
    const current = await make('freeze-current')
    await setBake(current, bakeRecord('current', await loadBakeFingerprint(current), now()))
    const unbaked = await make('freeze-unbaked', 'e2e-unbaked')
    await setBake(unbaked, bakeRecord('unbaked', 'fp-old', null))

    expect(await frozenBakeId(unreviewed)).toBeNull()
    expect(await frozenBakeId(stale)).toBeNull()
    expect(await frozenBakeId(current)).toBe('current')
    // Spaces without baked lighting freeze as before.
    expect(await frozenBakeId(unbaked)).toBe('unbaked')
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: created } } })
  }
})

type Roles = {
  admin: APIRequestContext
  artist: APIRequestContext
  anon: APIRequestContext
  /** Creates a fixture exhibition, deleted (in a finally) when the test ends. */
  create: (f: Fixture) => ReturnType<typeof createExhibition>
}

const it = test.extend<Roles>({
  admin: async ({ playwright, baseURL }, provide) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ADMIN })
    try {
      await provide(ctx)
    } finally {
      await ctx.dispose()
    }
  },
  artist: async ({ playwright, baseURL }, provide) => {
    const ctx = await playwright.request.newContext({ baseURL, storageState: ARTIST })
    try {
      await provide(ctx)
    } finally {
      await ctx.dispose()
    }
  },
  anon: async ({ playwright, baseURL }, provide) => {
    const ctx = await playwright.request.newContext({ baseURL })
    try {
      await provide(ctx)
    } finally {
      await ctx.dispose()
    }
  },
  create: async ({}, provide) => {
    const created: string[] = []
    try {
      await provide(async (f) => {
        const ex = await createExhibition(f)
        created.push(ex.id)
        return ex
      })
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: created } } })
    }
  },
})

it.describe('publishing a baked room', () => {
  it('the artist cannot publish; the admin needs a current, reviewed bake; publish ships exactly that bake', async ({
    admin,
    artist,
    create,
  }) => {
    const { id } = await create({ tag: 'flow', published: false, spacePublished: true })

    const before = await publishState(id)
    expect(
      (await artist.put(`/api/exhibitions/${id}`, { data: { published: true } })).status(),
    ).toBe(403)
    expect(await publishState(id)).toEqual(before)

    await expectRefused(admin, id, { published: true }, 'BAKE_REQUIRED')

    await setBake(id, bakeRecord('b1', await loadBakeFingerprint(id), null))
    await expectRefused(admin, id, { published: true }, 'BAKE_UNREVIEWED')

    await setBake(id, bakeRecord('b1', await loadBakeFingerprint(id), now()))
    // The artist saves a light change after the bake.
    await expectOk(artist, id, { wallColor: '#f0f0f0' })
    await expectRefused(admin, id, { published: true }, 'BAKE_STALE')

    // Bake again, review it: the publish ships exactly that bake.
    await setBake(id, bakeRecord('b2', await loadBakeFingerprint(id), now()))
    await expectOk(admin, id, { published: true })
    const after = await publishState(id)
    expect(after.published).toBe(true)
    expect(after.hasPendingChanges).toBe(false)
    const snapshot = after.publishedSnapshot as unknown as Snapshot
    expect(snapshot.exhibition.bake?.id).toBe('b2')
    expect(snapshot.exhibition.wallColor).toBe('#f0f0f0')
  })

  it('switching the room on for a live exhibition needs the bake too', async ({
    admin,
    artist,
    create,
  }) => {
    const { id } = await create({ tag: 'space', published: true, spacePublished: false })

    expect(
      (await artist.put(`/api/exhibitions/${id}`, { data: { spacePublished: true } })).status(),
    ).toBe(403)
    await expectRefused(admin, id, { spacePublished: true }, 'BAKE_REQUIRED')

    await setBake(id, bakeRecord('b1', await loadBakeFingerprint(id), now()))
    await expectOk(admin, id, { spacePublished: true })
    const after = await publishState(id)
    expect(after.spacePublished).toBe(true)
    expect((await snapshotOf(id))?.exhibition.bake?.id).toBe('b1')
  })

  it('updating a live room: a title change republishes, a light change needs a new bake', async ({
    admin,
    artist,
    anon,
    create,
  }) => {
    const { id } = await create({ tag: 'update', published: true, spacePublished: true })
    await setBake(id, bakeRecord('b1', await loadBakeFingerprint(id), now()))
    await expectOk(admin, id, { published: true })

    // Title only: the fingerprint is unchanged, so "Update Exhibition" goes through.
    await expectOk(artist, id, { mainTitle: `E2E Bake Gate retitled ${stamp()}` })
    expect((await publishState(id)).hasPendingChanges).toBe(true)
    await expectOk(admin, id, { published: true })
    expect((await publishState(id)).hasPendingChanges).toBe(false)
    expect((await snapshotOf(id))?.exhibition.bake?.id).toBe('b1')

    // hasPendingChanges: false on a live room is a publish as well.
    await expectOk(artist, id, { mainTitle: `E2E Bake Gate retitled again ${stamp()}` })
    await expectOk(admin, id, { hasPendingChanges: false })
    expect((await publishState(id)).hasPendingChanges).toBe(false)

    // A light change after the bake: every way of publishing it is refused, and the
    // visitors keep the room they had.
    await expectOk(artist, id, { wallColor: '#e0e0e0' })
    expect(
      (await artist.put(`/api/exhibitions/${id}`, { data: { hasPendingChanges: false } })).status(),
    ).toBe(403)
    await expectRefused(admin, id, { hasPendingChanges: false }, 'BAKE_STALE')
    await expectRefused(admin, id, { published: true }, 'BAKE_STALE')
    await expectRefused(admin, id, { spacePublished: true }, 'BAKE_STALE')
    const { url } = await prisma.exhibition.findUniqueOrThrow({ where: { id } })
    const visitor = await anon.get(`/api/exhibitions/by-url/${url}`).then((r) => r.json())
    expect(visitor.bake.id).toBe('b1')
    expect(visitor.wallColor).not.toBe('#e0e0e0')
  })

  it('page-only publishes need no bake; the room is checked when it goes public', async ({
    admin,
    create,
  }) => {
    const page = await create({ tag: 'page', published: false, spacePublished: false })
    await expectOk(admin, page.id, { published: true })
    expect((await publishState(page.id)).published).toBe(true)

    // A page-only publish never freezes a bake the gate would refuse: owners, admins and
    // preview links can open that snapshot's room.
    const unreviewed = await create({
      tag: 'page-unreviewed',
      published: false,
      spacePublished: false,
    })
    await setBake(
      unreviewed.id,
      bakeRecord('unreviewed', await loadBakeFingerprint(unreviewed.id), null),
    )
    await expectOk(admin, unreviewed.id, { published: true })
    expect((await snapshotOf(unreviewed.id))?.exhibition.bake).toBeNull()
    const reviewed = await create({ tag: 'page-reviewed', published: false, spacePublished: false })
    await setBake(
      reviewed.id,
      bakeRecord('reviewed', await loadBakeFingerprint(reviewed.id), now()),
    )
    await expectOk(admin, reviewed.id, { published: true })
    expect((await snapshotOf(reviewed.id))?.exhibition.bake?.id).toBe('reviewed')

    // Room switched on while the page is still unpublished: nobody sees it yet, and
    // nothing is frozen (the draft bake is unreviewed)…
    const draft = await create({
      tag: 'draft-room',
      published: false,
      spacePublished: false,
      bake: bakeRecord('draft', 'fp-old', null),
    })
    await expectOk(admin, draft.id, { spacePublished: true })
    const switched = await publishState(draft.id)
    expect(switched.spacePublished).toBe(true)
    expect(switched.publishedSnapshot).toBeNull()
    // …and publishing the page then puts the room in front of visitors: refused.
    await expectRefused(admin, draft.id, { published: true }, 'BAKE_STALE')
    // Publishing the page with the room switched off in the same request is page-only.
    await expectOk(admin, draft.id, { published: true, spacePublished: false })
    const pageOnly = await publishState(draft.id)
    expect(pageOnly.published).toBe(true)
    expect(pageOnly.spacePublished).toBe(false)
    expect((pageOnly.publishedSnapshot as unknown as Snapshot).exhibition.bake).toBeNull()
  })

  it('a body mixing publish keys with other edits needs an admin and the owner', async ({
    admin,
    artist,
    create,
  }) => {
    const { id } = await create({
      tag: 'mixed',
      spaceId: 'e2e-unbaked',
      published: false,
      spacePublished: false,
    })
    const before = await publishState(id)

    // The owner can't publish, not even alongside an edit.
    const owner = await artist.put(`/api/exhibitions/${id}`, {
      data: { published: true, wallColor: '#c0c0c0' },
    })
    expect(owner.status()).toBe(403)
    expect(await publishState(id)).toEqual(before)

    // An admin who isn't the owner can't edit alongside a publish key: only a superAdmin
    // gets past the ownership check (a plain admin would get 403; see the decision test).
    const { userType } = await prisma.user.findFirstOrThrow({
      where: { email: process.env.E2E_ADMIN_EMAIL },
      select: { userType: true },
    })
    const mixed = await admin.put(`/api/exhibitions/${id}`, {
      data: { previewEnabled: false, wallColor: '#c0c0c0' },
    })
    expect(mixed.status()).toBe(userType === 'superAdmin' ? 200 : 403)

    // A publish-only body: any admin, as before.
    await expectOk(admin, id, { published: true })
    expect((await publishState(id)).published).toBe(true)
  })

  it('a space without baked lighting publishes and previews as before', async ({
    admin,
    artist,
    create,
  }) => {
    const { id } = await create({
      tag: 'unbaked',
      spaceId: 'e2e-unbaked',
      published: false,
      spacePublished: true,
    })

    expect(
      (await artist.put(`/api/exhibitions/${id}`, { data: { previewEnabled: true } })).status(),
    ).toBe(403)
    await expectOk(admin, id, { previewEnabled: true })
    const preview = await publishState(id)
    expect(preview.previewToken).not.toBeNull()
    expect(preview.publishedSnapshot, 'the unbaked preview still freezes a snapshot').not.toBeNull()

    await expectOk(admin, id, { published: true })
    const after = await publishState(id)
    expect(after.published).toBe(true)
    expect((after.publishedSnapshot as unknown as Snapshot).exhibition.bake).toBeNull()
  })

  it('in a baked space the preview toggle never freezes or clears the visitors’ room', async ({
    admin,
    artist,
    anon,
    create,
  }) => {
    const live = await create({
      tag: 'preview-live',
      published: true,
      spacePublished: true,
      bake: bakeRecord('draft', 'fp-old', null),
      publishedSnapshot: {
        exhibition: { spaceId: 'paris', bake: bakeRecord('pub', 'fp-pub', now()) },
        artworks: [],
      },
    })
    const before = await publishState(live.id)

    expect(
      (
        await artist.put(`/api/exhibitions/${live.id}`, { data: { previewEnabled: true } })
      ).status(),
    ).toBe(403)
    await expectOk(admin, live.id, { previewEnabled: true })
    const on = await publishState(live.id)
    expect(on.previewEnabled).toBe(true)
    expect(on.previewToken).not.toBeNull()
    expect(on.publishedSnapshot).toEqual(before.publishedSnapshot)
    expect(on.hasPendingChanges).toBe(before.hasPendingChanges)
    const visitor = await anon.get(`/api/exhibitions/by-url/${live.url}`).then((r) => r.json())
    expect(visitor.bake.id).toBe('pub')

    await expectOk(admin, live.id, { previewEnabled: false })
    const off = await publishState(live.id)
    expect(off.previewToken).toBeNull()
    expect(off.publishedSnapshot).toEqual(before.publishedSnapshot)
    expect(off.hasPendingChanges).toBe(before.hasPendingChanges)

    // An unpublished one: the preview link does not freeze the unreviewed draft bake,
    // and neither does "Update Exhibition" for its preview.
    const draft = await create({
      tag: 'preview-draft',
      published: false,
      spacePublished: true,
      bake: bakeRecord('draft', 'fp-old', null),
    })
    await expectOk(admin, draft.id, { previewEnabled: true })
    expect((await publishState(draft.id)).publishedSnapshot).toBeNull()
    await expectOk(artist, draft.id, { wallColor: '#d0d0d0' })
    await expectOk(admin, draft.id, { hasPendingChanges: false })
    expect((await publishState(draft.id)).publishedSnapshot).toBeNull()
  })

  it('a publish deletes the previously published bake’s files, never the new one or the draft', async ({
    admin,
    artist,
    create,
  }) => {
    const { id } = await create({ tag: 'cleanup', published: true, spacePublished: true })
    const started: string[] = []

    // The admin's real bake flow: start (fresh id + upload URL), upload, save, review.
    const bake = async () => {
      const startRes = await admin.post(`/api/exhibitions/${id}/bake/uploads`, {
        data: { files: ['wall-light.png'] },
      })
      expect(startRes.status()).toBe(200)
      const { bakeId, uploads } = (await startRes.json()) as {
        bakeId: string
        uploads: { url: string; publicUrl: string }[]
      }
      started.push(bakeId)
      const [upload] = uploads
      if (upload.url.startsWith('/')) {
        expect((await admin.put(upload.url, { data: PNG })).status()).toBe(200)
      } else {
        const put = await fetch(upload.url, {
          method: 'PUT',
          body: PNG,
          headers: { 'Content-Type': 'image/png', 'Cache-Control': CACHE },
        })
        expect(put.status).toBe(200)
      }
      const { bakedBy: _bakedBy, ...sent } = bakeRecord(
        bakeId,
        await loadBakeFingerprint(id),
        null,
        [
          {
            receiver: 'wall',
            kind: 'light',
            url: upload.publicUrl,
            width: 1,
            height: 1,
            encoding: { format: 'log16', max: 1, knee: 1 },
          },
        ],
      )
      expect((await admin.put(`/api/exhibitions/${id}/bake`, { data: sent })).status()).toBe(200)
      expect(
        (await admin.post(`/api/exhibitions/${id}/bake/reviewed`, { data: { bakeId } })).status(),
      ).toBe(200)
      return { bakeId, file: upload.publicUrl }
    }
    const stored = async (file: string) => (await bakeObjectSize(file)) !== null

    try {
      const first = await bake()
      await expectOk(admin, id, { published: true })
      expect((await snapshotOf(id))?.exhibition.bake?.id).toBe(first.bakeId)

      const second = await bake()
      // Saving the new draft keeps the published bake's files.
      expect(await stored(first.file)).toBe(true)
      await expectOk(admin, id, { published: true })
      expect((await snapshotOf(id))?.exhibition.bake?.id).toBe(second.bakeId)
      expect(await stored(first.file), 'the replaced published bake is deleted').toBe(false)
      expect(await stored(second.file), 'the new published bake (= the draft) stays').toBe(true)

      // Republishing the same bake (title change) deletes nothing.
      await expectOk(artist, id, { mainTitle: `E2E Bake Gate cleanup retitled ${stamp()}` })
      await expectOk(admin, id, { published: true })
      expect(await stored(second.file)).toBe(true)

      // A cleanup that fails never fails the publish.
      const snapshot = (await snapshotOf(id))!
      await prisma.exhibition.update({
        where: { id },
        data: {
          publishedSnapshot: json({
            ...snapshot,
            exhibition: {
              ...snapshot.exhibition,
              bake: { ...snapshot.exhibition.bake, id: 'no.such/bake' },
            },
          }),
        },
      })
      await expectOk(admin, id, { published: true })
      expect((await snapshotOf(id))?.exhibition.bake?.id).toBe(second.bakeId)
      expect(await stored(second.file)).toBe(true)
    } finally {
      for (const bakeId of started) await deleteBakeObjects(id, bakeId).catch(() => {})
    }
  })
})

test.describe('the admin exhibitions list', () => {
  test.use({ storageState: ADMIN })

  test('explains a refused publish next to the action and links to the 3D editor', async ({
    page,
  }) => {
    const ex = await createExhibition({
      tag: 'ui',
      published: false,
      spacePublished: true,
      // Keeps "Publish exhibition" enabled whatever the fixture artist's own state.
      previewEnabled: true,
    })
    try {
      await page.goto('/admin/exhibitions')
      const row = page.locator('tr', { hasText: ex.mainTitle })
      await row.getByRole('button', { name: 'Actions' }).click()
      await page.getByRole('menuitem', { name: 'Publish exhibition' }).click()

      await expect(row.getByText(MESSAGES.BAKE_REQUIRED)).toBeVisible()
      await expect(row.getByRole('link', { name: 'Open the 3D editor' })).toHaveAttribute(
        'href',
        `/exhibitions/${ex.handler}/${ex.url}/edit`,
      )
      expect((await publishState(ex.id)).published).toBe(false)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: ex.id } })
    }
  })

  // The dashboard offers "Update Exhibition" for a live exhibition only while it has pending
  // changes, so a reviewed bake that visitors don't have yet must count as one.
  test('a reviewed new bake of a live room offers "Update Exhibition", which ships it', async ({
    page,
  }) => {
    const ex = await createExhibition({ tag: 'ui-update', published: true, spacePublished: true })
    const admin = page.request
    const pending = async () => (await publishState(ex.id)).hasPendingChanges
    // The admin's bake page: save the draft bake (no map files needed here), then review it.
    const bakeAndReview = async (bakeId: string) => {
      const { bakedBy: _bakedBy, ...sent } = bakeRecord(
        bakeId,
        await loadBakeFingerprint(ex.id),
        null,
      )
      const saved = await admin.put(`/api/exhibitions/${ex.id}/bake`, { data: sent })
      expect(saved.status(), await saved.text()).toBe(200)
      // An unreviewed draft is nothing to publish yet.
      expect(await pending()).toBe(false)
      const reviewed = await admin.post(`/api/exhibitions/${ex.id}/bake/reviewed`, {
        data: { bakeId },
      })
      expect(reviewed.status(), await reviewed.text()).toBe(200)
    }
    try {
      // Visitors have no bake yet: the reviewed one is pending; publishing ships it.
      await bakeAndReview('b1')
      expect(await pending()).toBe(true)
      expect(
        (await admin.put(`/api/exhibitions/${ex.id}`, { data: { published: true } })).status(),
      ).toBe(200)
      expect((await snapshotOf(ex.id))?.exhibition.bake?.id).toBe('b1')
      expect(await pending()).toBe(false)

      // Reviewing the bake visitors already have again changes nothing.
      const again = await admin.post(`/api/exhibitions/${ex.id}/bake/reviewed`, {
        data: { bakeId: 'b1' },
      })
      expect(again.status()).toBe(200)
      expect(await pending()).toBe(false)

      // A new bake, reviewed: the row needs review and offers "Update Exhibition"…
      await bakeAndReview('b2')
      expect(await pending()).toBe(true)
      await page.goto('/admin/exhibitions')
      const row = page.locator('tr', { hasText: ex.mainTitle })
      await expect(row.getByText('Needs Review')).toBeVisible()
      await row.getByRole('button', { name: 'Actions' }).click()
      await page.getByRole('menuitem', { name: 'Update Exhibition' }).click()
      // …which ships it to visitors.
      await expect
        .poll(async () => (await snapshotOf(ex.id))?.exhibition.bake?.id ?? null)
        .toBe('b2')
      expect(await pending()).toBe(false)
      await expect(row.getByText('Up to date')).toBeVisible()

      // "Update Exhibition" as a clear of pending changes ships it as well.
      await bakeAndReview('b3')
      expect(await pending()).toBe(true)
      const update = await admin.put(`/api/exhibitions/${ex.id}`, {
        data: { hasPendingChanges: false },
      })
      expect(update.status(), await update.text()).toBe(200)
      expect((await snapshotOf(ex.id))?.exhibition.bake?.id).toBe('b3')
      expect(await pending()).toBe(false)

      // A room switched off shows visitors no bake: nothing pending.
      await prisma.exhibition.update({ where: { id: ex.id }, data: { spacePublished: false } })
      await bakeAndReview('b4')
      expect(await pending()).toBe(false)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: ex.id } })
    }
  })
})
