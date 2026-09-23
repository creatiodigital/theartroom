import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * Membership and placement are separate facts. The wall editor owns placement
 * and must never touch membership — an artist tidying a wall is not curating
 * the show.
 *
 * Talks to the position-sync endpoint directly. No WebGL.
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

test.describe('the wall save and exhibition membership', () => {
  test('clearing a wall leaves the artwork in the exhibition', async ({ request }) => {
    const owner = await fixtureOwner()
    const exhibition = await createExhibition(owner.id, owner.handler, 'E2E Wall Membership')
    const artwork = await createArtwork(owner.id, 'E2E Wall Art')
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
      // An empty positions array is what the editor sends when the last work
      // is dragged off the wall.
      const res = await request.post('/api/exhibition-artworks', {
        data: { exhibitionId: exhibition.id, positions: [] },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const row = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: artwork.id },
        },
      })

      // The row survives, the membership survives, only the coordinates go.
      expect(row, 'the row must survive — the work is still in the show').not.toBeNull()
      expect(row?.showOnPage).toBe(true)
      expect(row?.wallId).toBeNull()
      expect(row?.posX3d).toBeNull()
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
      await prisma.artwork.deleteMany({ where: { id: artwork.id } })
    }
  })

  test('clearing a wall deletes a row that was never on the page', async ({ request }) => {
    const owner = await fixtureOwner()
    const exhibition = await createExhibition(owner.id, owner.handler, 'E2E Wall 3D Only')
    const artwork = await createArtwork(owner.id, 'E2E 3D Only')
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: false,
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
      const res = await request.post('/api/exhibition-artworks', {
        data: { exhibitionId: exhibition.id, positions: [] },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      // Neither placed nor a member — nothing left worth keeping.
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

  test('a page-only artwork absent from the payload for its own reason is not deleted', async ({
    request,
  }) => {
    // The wall editor only ever loads PLACED rows (wallId not null) — see
    // GET /api/exhibition-artworks?mode=edit. A page-only artwork (member,
    // never hung) is therefore ALSO absent from the save payload, for a
    // reason that has nothing to do with being dragged off a wall: the
    // editor never saw it to begin with. It must land in the same
    // clear-placement branch as a freshly-unhung work (nulling already-null
    // columns is a harmless no-op) and must NOT be deleted.
    const owner = await fixtureOwner()
    const exhibition = await createExhibition(owner.id, owner.handler, 'E2E Wall Page Only')
    const hungArtwork = await createArtwork(owner.id, 'E2E Wall Page Only Hung')
    const pageOnlyArtwork = await createArtwork(owner.id, 'E2E Wall Page Only Unplaced')
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: hungArtwork.id,
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
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: pageOnlyArtwork.id,
        showOnPage: true,
        // Already unplaced — every placement column starts null, and the
        // editor never loaded this row.
      },
    })

    try {
      // The payload reflects only what the editor rendered: the hung work,
      // moved to a new spot. It cannot echo back a row it never loaded.
      const res = await request.post('/api/exhibition-artworks', {
        data: {
          exhibitionId: exhibition.id,
          positions: [
            {
              artworkId: hungArtwork.id,
              wallId: 'wall1',
              posX2d: 2,
              posY2d: 2,
              width2d: 1,
              height2d: 1,
              posX3d: 2,
              posY3d: 2,
              posZ3d: 2,
              quaternionX: 0,
              quaternionY: 0,
              quaternionZ: 0,
              quaternionW: 1,
            },
          ],
        },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const pageOnlyRow = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: pageOnlyArtwork.id },
        },
      })
      expect(
        pageOnlyRow,
        'a page-only row the editor never saw must survive an unrelated wall save',
      ).not.toBeNull()
      expect(pageOnlyRow?.showOnPage).toBe(true)
      expect(pageOnlyRow?.wallId).toBeNull()

      const hungRow = await prisma.exhibitionArtwork.findUnique({
        where: {
          exhibitionId_artworkId: { exhibitionId: exhibition.id, artworkId: hungArtwork.id },
        },
      })
      expect(hungRow, 'the placed row from the payload should still be there').not.toBeNull()
      expect(hungRow?.wallId).toBe('wall1')
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
      await prisma.artwork.deleteMany({
        where: { id: { in: [hungArtwork.id, pageOnlyArtwork.id] } },
      })
    }
  })
})
