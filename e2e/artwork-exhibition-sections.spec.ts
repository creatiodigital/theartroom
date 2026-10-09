import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * The artwork PUT carries one section per ticked exhibition in
 * `exhibitionSections`, beside `exhibitionIds`. The GET returns the same map so
 * the form can pre-select. A section id from a different exhibition is refused
 * outright — and echoing the GET payload back (what the wall-view modal does)
 * must never change anything.
 *
 * Talks to the route directly. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function setup() {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
  const mk = (name: string) =>
    prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: name,
        url: `e2e-art-sections-${stamp()}`,
        spaceId: 'paris',
        status: 'current',
      },
      select: { id: true },
    })
  const showA = await mk('E2E Sections Show A')
  const showB = await mk('E2E Sections Show B')
  const sectionA = await prisma.exhibitionSection.create({
    data: { exhibitionId: showA.id, title: 'Magnolia', order: 0 },
  })
  const sectionB = await prisma.exhibitionSection.create({
    data: { exhibitionId: showB.id, title: 'Memory', order: 0 },
  })
  const artwork = await prisma.artwork.create({
    data: { userId: owner.id, name: 'E2E Sections Work', slug: `e2e-sections-work-${stamp()}` },
    select: { id: true },
  })
  const cleanup = async () => {
    await prisma.exhibition.deleteMany({ where: { id: { in: [showA.id, showB.id] } } })
    await prisma.artwork.deleteMany({ where: { id: artwork.id } })
  }
  return { showA, showB, sectionA, sectionB, artwork, cleanup }
}

const row = (exhibitionId: string, artworkId: string) =>
  prisma.exhibitionArtwork.findUnique({
    where: { exhibitionId_artworkId: { exhibitionId, artworkId } },
  })

test('ticking an exhibition with a section stores it, and GET returns it', async ({ request }) => {
  const s = await setup()
  try {
    const res = await request.put(`/api/artworks/${s.artwork.id}`, {
      data: {
        exhibitionIds: [s.showA.id, s.showB.id],
        exhibitionSections: { [s.showA.id]: s.sectionA.id, [s.showB.id]: null },
      },
    })
    expect(res.status()).toBe(200)
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)
    expect((await row(s.showB.id, s.artwork.id))?.sectionId).toBeNull()

    const got = await (await request.get(`/api/artworks/${s.artwork.id}`)).json()
    expect(got.exhibitionSections).toEqual({ [s.showA.id]: s.sectionA.id, [s.showB.id]: null })
  } finally {
    await s.cleanup()
  }
})

test('changing and clearing the section of an existing member', async ({ request }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: { exhibitionId: s.showA.id, artworkId: s.artwork.id, showOnPage: true },
  })
  try {
    await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: [s.showA.id], exhibitionSections: { [s.showA.id]: s.sectionA.id } },
    })
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)

    await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: [s.showA.id], exhibitionSections: { [s.showA.id]: null } },
    })
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBeNull()
  } finally {
    await s.cleanup()
  }
})

test('a section from a different exhibition is a 400 and writes nothing', async ({ request }) => {
  const s = await setup()
  try {
    const res = await request.put(`/api/artworks/${s.artwork.id}`, {
      data: {
        name: 'Should Not Save',
        exhibitionIds: [s.showA.id],
        exhibitionSections: { [s.showA.id]: s.sectionB.id },
      },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toMatch(/different exhibition/)
    expect(await row(s.showA.id, s.artwork.id), 'no membership created').toBeNull()
    const artwork = await prisma.artwork.findUniqueOrThrow({ where: { id: s.artwork.id } })
    expect(artwork.name).toBe('E2E Sections Work')
  } finally {
    await s.cleanup()
  }
})

test('echoing the GET payload back changes nothing (wall-view modal save)', async ({ request }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.showA.id,
      artworkId: s.artwork.id,
      showOnPage: true,
      sectionId: s.sectionA.id,
    },
  })
  try {
    const got = await (await request.get(`/api/artworks/${s.artwork.id}`)).json()
    const res = await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: got.exhibitionIds, exhibitionSections: got.exhibitionSections },
    })
    expect(res.status()).toBe(200)
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)
  } finally {
    await s.cleanup()
  }
})

test('a PUT without exhibitionSections leaves existing sections alone', async ({ request }) => {
  const s = await setup()
  await prisma.exhibitionArtwork.create({
    data: {
      exhibitionId: s.showA.id,
      artworkId: s.artwork.id,
      showOnPage: true,
      sectionId: s.sectionA.id,
    },
  })
  try {
    await request.put(`/api/artworks/${s.artwork.id}`, {
      data: { exhibitionIds: [s.showA.id] },
    })
    expect((await row(s.showA.id, s.artwork.id))?.sectionId).toBe(s.sectionA.id)
  } finally {
    await s.cleanup()
  }
})
