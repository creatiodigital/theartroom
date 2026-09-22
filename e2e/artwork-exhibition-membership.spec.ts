import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * `PUT /api/artworks/[id]` accepts an `exhibitionIds` array naming every show
 * the artwork should appear in. The client always sends its full desired set,
 * so the server diffs against what already exists rather than appending.
 *
 * Membership is `showOnPage`, not row existence: a work can be hung in a
 * room (placement columns set) while unchecked from the page, and re-checking
 * it must flip that flag rather than insert a second row the
 * `@@unique([exhibitionId, artworkId])` constraint would reject. Unchecking a
 * hung work keeps its coordinates (it stays in the 3D room); unchecking a work
 * that was never hung leaves nothing worth keeping, so the row goes.
 *
 * The requested ids are intersected with exhibitions that exist AND belong to
 * the artwork's owner — an authorization boundary, not a convenience. Without
 * it, one artist could curate their work into another artist's show just by
 * sending its id.
 *
 * Talks to the route directly. No WebGL.
 */
test.use({ storageState: 'e2e/.auth/artist.json' })

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function createExhibition(userId: string, handler: string, name: string) {
  const s = stamp()
  return prisma.exhibition.create({
    data: {
      userId,
      handler,
      mainTitle: name,
      url: `e2e-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s}`,
      spaceId: 'paris',
      status: 'draft',
    },
    select: { id: true },
  })
}

async function createArtwork(userId: string, name: string) {
  const s = stamp()
  return prisma.artwork.create({
    data: {
      userId,
      name,
      slug: `e2e-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s}`,
    },
    select: { id: true },
  })
}

test.describe('the artwork save and exhibition membership', () => {
  test('checking an artwork into an exhibition creates a member row with no placement', async ({
    request,
  }) => {
    const owner = await fixtureOwner()
    const exhibition = await createExhibition(owner.id, owner.handler, 'Membership Check')
    const artwork = await createArtwork(owner.id, 'Membership Artwork')

    try {
      const res = await request.put(`/api/artworks/${artwork.id}`, {
        data: { exhibitionIds: [exhibition.id] },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const row = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
        },
      })
      expect(row, 'a member row should exist').not.toBeNull()
      expect(row?.showOnPage).toBe(true)
      // On the page, not hung anywhere — every placement column stays null.
      expect(row?.wallId).toBeNull()
      expect(row?.posX3d).toBeNull()
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
      await prisma.artwork.deleteMany({ where: { id: artwork.id } })
    }
  })

  test('unchecking a hung work keeps its coordinates and sets showOnPage false', async ({
    request,
  }) => {
    const owner = await fixtureOwner()
    const exhibition = await createExhibition(owner.id, owner.handler, 'Uncheck Hung')
    const artwork = await createArtwork(owner.id, 'Uncheck Hung Artwork')
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: true,
        wallId: 'wall0',
        posX2d: 1,
        posY2d: 1,
        width2d: 1,
        height2d: 1,
        posX3d: 1,
        posY3d: 1,
        posZ3d: 1,
        quaternionX: 0,
        quaternionY: 0,
        quaternionZ: 0,
        quaternionW: 1,
      },
    })

    try {
      // The desired set no longer includes this exhibition — the artist
      // unchecked it on the form.
      const res = await request.put(`/api/artworks/${artwork.id}`, {
        data: { exhibitionIds: [] },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const row = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
        },
      })
      expect(row, 'the row must survive — the work is still hanging in the room').not.toBeNull()
      expect(row?.showOnPage).toBe(false)
      expect(row?.wallId).toBe('wall0')
      expect(row?.posX3d).toBe(1)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
      await prisma.artwork.deleteMany({ where: { id: artwork.id } })
    }
  })

  test('unchecking an unhung work deletes the row', async ({ request }) => {
    const owner = await fixtureOwner()
    const exhibition = await createExhibition(owner.id, owner.handler, 'Uncheck Unhung')
    const artwork = await createArtwork(owner.id, 'Uncheck Unhung Artwork')
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: true,
        // Never hung — every placement column stays null.
      },
    })

    try {
      const res = await request.put(`/api/artworks/${artwork.id}`, {
        data: { exhibitionIds: [] },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const row = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
        },
      })
      expect(row, 'nothing is left worth keeping — the row must be gone').toBeNull()
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
      await prisma.artwork.deleteMany({ where: { id: artwork.id } })
    }
  })

  test('an id belonging to another artist is dropped while the rest of the save succeeds', async ({
    request,
  }) => {
    const owner = await fixtureOwner()
    const ownExhibition = await createExhibition(owner.id, owner.handler, 'Own Show')
    const artwork = await createArtwork(owner.id, 'Cross Owner Artwork')

    const s = stamp()
    const otherArtist = await prisma.user.create({
      data: {
        name: 'E2E Other',
        lastName: 'Artist',
        biography: 'E2E throwaway.',
        email: `e2e-other-artist-${s}@example.com`,
        handler: `e2e-other-artist-${s}`,
        userType: 'artist',
      },
      select: { id: true, handler: true },
    })
    const otherExhibition = await createExhibition(
      otherArtist.id,
      otherArtist.handler,
      'Someone Elses Show',
    )

    try {
      const res = await request.put(`/api/artworks/${artwork.id}`, {
        data: { exhibitionIds: [ownExhibition.id, otherExhibition.id] },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const ownRow = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: ownExhibition.id, artworkId: artwork.id },
        },
      })
      expect(ownRow, 'the legit id in the same call must still take effect').not.toBeNull()
      expect(ownRow?.showOnPage).toBe(true)

      const foreignRow = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: otherExhibition.id, artworkId: artwork.id },
        },
      })
      expect(
        foreignRow,
        'an id owned by another artist must never create a row, silently or otherwise',
      ).toBeNull()
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [ownExhibition.id, otherExhibition.id] } } })
      await prisma.artwork.deleteMany({ where: { id: artwork.id } })
      await prisma.user.deleteMany({ where: { id: otherArtist.id } })
    }
  })
})
