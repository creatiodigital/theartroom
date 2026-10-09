import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * The section routes under /api/exhibitions/[id]/sections. Every change saves
 * on its own; the rules that matter are the ones a person would trip over:
 * duplicate names, renames keeping the works, deletes never losing a work,
 * reorders that can't be smuggled a foreign or missing id, and no access to
 * another artist's show.
 *
 * Talks to the routes directly. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

async function createExhibition(userId: string, handler: string) {
  return prisma.exhibition.create({
    data: {
      userId,
      handler,
      mainTitle: 'E2E Sections API',
      url: `e2e-sections-api-${stamp()}`,
      spaceId: 'paris',
      status: 'current',
    },
    select: { id: true },
  })
}

test('create appends, rejects blank, long and duplicate names', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const base = `/api/exhibitions/${exhibition.id}/sections`
  try {
    const first = await request.post(base, { data: { title: '  Magnolia  ' } })
    expect(first.status()).toBe(201)
    expect(await first.json()).toMatchObject({ title: 'Magnolia', order: 0, artworkCount: 0 })

    const second = await request.post(base, { data: { title: 'Mistery' } })
    expect((await second.json()).order).toBe(1)

    expect((await request.post(base, { data: { title: '   ' } })).status()).toBe(400)
    expect((await request.post(base, { data: { title: 'x'.repeat(61) } })).status()).toBe(400)
    const dup = await request.post(base, { data: { title: 'magnolia' } })
    expect(dup.status()).toBe(400)
    expect((await dup.json()).error).toMatch(/already has a section/)

    const list = await (await request.get(base)).json()
    expect(list.map((s: { title: string }) => s.title)).toEqual(['Magnolia', 'Mistery'])
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})

test('rename keeps its works; case-only rename of itself is allowed; duplicate is not', async ({
  request,
}) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Rename Work', slug: `e2e-rename-work-${stamp()}` },
  })
  const [mistery, memory] = await Promise.all([
    prisma.exhibitionSection.create({
      data: { exhibitionId: exhibition.id, title: 'Mistery', order: 0 },
    }),
    prisma.exhibitionSection.create({
      data: { exhibitionId: exhibition.id, title: 'Memory', order: 1 },
    }),
  ])
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: mistery.id,
    },
  })
  const url = (id: string) => `/api/exhibitions/${exhibition.id}/sections/${id}`
  try {
    const renamed = await request.patch(url(mistery.id), { data: { title: 'Mystery' } })
    expect(renamed.status()).toBe(200)
    expect(await renamed.json()).toMatchObject({ title: 'Mystery', artworkCount: 1 })

    const row = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(row.sectionId, 'rename must not touch assignments').toBe(mistery.id)

    expect((await request.patch(url(mistery.id), { data: { title: 'MYSTERY' } })).status()).toBe(
      200,
    )
    expect((await request.patch(url(mistery.id), { data: { title: 'memory ' } })).status()).toBe(
      400,
    )
    expect((await request.patch(url(memory.id), { data: { title: '' } })).status()).toBe(400)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('delete returns its works to no section and keeps them on the page', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Delete Work', slug: `e2e-delete-work-${stamp()}` },
  })
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Memory', order: 0 },
  })
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: exhibition.id,
      artworkId: artwork.id,
      showOnPage: true,
      sectionId: section.id,
    },
  })
  try {
    const res = await request.delete(`/api/exhibitions/${exhibition.id}/sections/${section.id}`)
    expect(res.status()).toBe(200)

    const row = await prisma.exhibitionArtwork.findUniqueOrThrow({
      where: { exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id } },
    })
    expect(row.sectionId).toBeNull()
    expect(row.showOnPage).toBe(true)
    expect(await prisma.artwork.findUnique({ where: { id: artwork.id } })).not.toBeNull()
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})

test('reorder accepts exactly the current set and rejects anything else', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const other = await createExhibition(owner.id, owner.handler)
  const [a, b, c] = await Promise.all(
    ['A', 'B', 'C'].map((title, order) =>
      prisma.exhibitionSection.create({ data: { exhibitionId: exhibition.id, title, order } }),
    ),
  )
  const foreign = await prisma.exhibitionSection.create({
    data: { exhibitionId: other.id, title: 'Foreign', order: 0 },
  })
  const url = `/api/exhibitions/${exhibition.id}/sections/order`
  try {
    const ok = await request.put(url, { data: { sectionIds: [c.id, a.id, b.id] } })
    expect(ok.status()).toBe(200)
    expect((await ok.json()).map((s: { title: string }) => s.title)).toEqual(['C', 'A', 'B'])

    for (const sectionIds of [
      [c.id, a.id], // missing one
      [c.id, a.id, a.id], // duplicate
      [c.id, a.id, foreign.id], // foreign
      'nope',
    ]) {
      expect((await request.put(url, { data: { sectionIds } })).status()).toBe(400)
    }
    const stored = await prisma.exhibitionSection.findMany({
      where: { exhibitionId: exhibition.id },
      orderBy: { order: 'asc' },
    })
    expect(stored.map((s) => s.title)).toEqual(['C', 'A', 'B'])
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: [exhibition.id, other.id] } } })
  }
})

test('a section id from another exhibition is a 404 on rename and delete', async ({ request }) => {
  const owner = await fixtureOwner()
  const exhibition = await createExhibition(owner.id, owner.handler)
  const other = await createExhibition(owner.id, owner.handler)
  const foreign = await prisma.exhibitionSection.create({
    data: { exhibitionId: other.id, title: 'Foreign', order: 0 },
  })
  const url = `/api/exhibitions/${exhibition.id}/sections/${foreign.id}`
  try {
    expect((await request.patch(url, { data: { title: 'Hijack' } })).status()).toBe(404)
    expect((await request.delete(url)).status()).toBe(404)
    expect(await prisma.exhibitionSection.findUnique({ where: { id: foreign.id } })).not.toBeNull()
  } finally {
    await prisma.exhibition.deleteMany({ where: { id: { in: [exhibition.id, other.id] } } })
  }
})

test("another artist's exhibition is 403 on every route", async ({ request }) => {
  const stranger = await prisma.user.findFirstOrThrow({
    where: { userType: 'artist', handler: { not: fixtures.artistSlug } },
    select: { id: true, handler: true },
  })
  const exhibition = await createExhibition(stranger.id, stranger.handler)
  const section = await prisma.exhibitionSection.create({
    data: { exhibitionId: exhibition.id, title: 'Theirs', order: 0 },
  })
  const base = `/api/exhibitions/${exhibition.id}/sections`
  try {
    expect((await request.get(base)).status()).toBe(403)
    expect((await request.post(base, { data: { title: 'Mine' } })).status()).toBe(403)
    expect(
      (await request.patch(`${base}/${section.id}`, { data: { title: 'Mine' } })).status(),
    ).toBe(403)
    expect((await request.delete(`${base}/${section.id}`)).status()).toBe(403)
    expect(
      (await request.put(`${base}/order`, { data: { sectionIds: [section.id] } })).status(),
    ).toBe(403)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
  }
})
