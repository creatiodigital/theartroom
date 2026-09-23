import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * `spacePublished` gates the 3D room alone — the "Enter Virtual Exhibition"
 * button on the public profile page, and the scene API that feeds /visit
 * (`GET /api/exhibitions/by-url/[url]`). The exhibition page, its artwork
 * grid, and every listing read `published` only and must never notice this
 * flag. `published` remains the outer gate: off, and the page itself is
 * gone regardless of the room.
 *
 * Flat-page and API checks: no WebGL, no /visit route.
 */

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

test.describe('the exhibition page and scene API when the 3D space alone is unpublished', () => {
  test('the page still renders its title and grid but hides the Enter button', async ({
    page,
  }) => {
    const owner = await fixtureOwner()
    const s = stamp()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: 'E2E Space Publish Off',
        url: `e2e-space-off-${s}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
        spacePublished: false,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: owner.id,
        name: 'E2E Space Off Work',
        title: `E2E Space Off ${s}`,
        slug: `e2e-space-off-work-${s}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/e2e-space-off.jpg',
      },
    })
    await prisma.exhibitionArtwork.create({
      data: { exhibitionId: exhibition.id, artworkId: artwork.id, showOnPage: true },
    })

    try {
      await page.goto(`/exhibitions/${owner.handler}/${exhibition.url}`)
      await expect(page.getByText('E2E Space Publish Off')).toBeVisible()
      await expect(page.getByText(`E2E Space Off ${s}`)).toBeVisible()
      await expect(page.getByRole('link', { name: 'Enter Virtual Exhibition' })).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })

  test('an anonymous request for the scene API 404s', async ({ request }) => {
    const owner = await fixtureOwner()
    const s = stamp()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: 'E2E Space Publish Off API',
        url: `e2e-space-off-api-${s}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
        spacePublished: false,
      },
    })

    try {
      const res = await request.get(`/api/exhibitions/by-url/${exhibition.url}`)
      expect(res.status()).toBe(404)
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
    }
  })
})

test.describe('the exhibition page when the whole exhibition is unpublished', () => {
  test('everything is hidden, including the page itself', async ({ page }) => {
    const owner = await fixtureOwner()
    const s = stamp()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: 'E2E Whole Show Unpublished',
        url: `e2e-whole-unpublished-${s}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
        // Even with the room switched on, the page must still 404 —
        // `published` is the outer gate the room can never override.
        spacePublished: true,
      },
    })

    try {
      await page.goto(`/exhibitions/${owner.handler}/${exhibition.url}`)
      await expect(page.getByText('Page not found')).toBeVisible()
      await expect(page.getByText('E2E Whole Show Unpublished')).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
    }
  })
})

test.describe('switching the 3D space on', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test('rebuilds publishedSnapshot from the currently placed rows', async ({ request }) => {
    const owner = await fixtureOwner()
    const s = stamp()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: 'E2E Space Publish On',
        url: `e2e-space-on-${s}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
        spacePublished: false,
        // A stale snapshot from before the room existed — the page went live
        // first. Rebuilding must replace this, not just leave it non-null.
        publishedSnapshot: { exhibition: {}, artworks: [] },
      },
    })
    const hung1 = await prisma.artwork.create({
      data: { userId: owner.id, name: 'E2E Space On Hung 1', slug: `e2e-space-on-hung1-${s}` },
      select: { id: true },
    })
    const hung2 = await prisma.artwork.create({
      data: { userId: owner.id, name: 'E2E Space On Hung 2', slug: `e2e-space-on-hung2-${s}` },
      select: { id: true },
    })
    const pageOnly = await prisma.artwork.create({
      data: { userId: owner.id, name: 'E2E Space On Page Only', slug: `e2e-space-on-page-${s}` },
      select: { id: true },
    })
    for (const artwork of [hung1, hung2]) {
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
    }
    await prisma.exhibitionArtwork.create({
      data: { exhibitionId: exhibition.id, artworkId: pageOnly.id, showOnPage: true },
    })

    try {
      const res = await request.put(`/api/exhibitions/${exhibition.id}`, {
        data: { spacePublished: true },
      })
      expect(res.ok(), `save should succeed: ${res.status()} ${await res.text()}`).toBe(true)

      const updated = await prisma.exhibition.findUniqueOrThrow({ where: { id: exhibition.id } })
      expect(updated.spacePublished).toBe(true)
      expect(updated.hasPendingChanges).toBe(false)

      const snapshot = updated.publishedSnapshot as { artworks: unknown[] } | null
      expect(snapshot, 'the snapshot must be rebuilt, not left as the stale placeholder').not.toBeNull()
      // Only the two HUNG rows are "placed" — the page-only row has no wall
      // to draw in the 3D room and must not appear in the scene snapshot.
      expect(snapshot?.artworks.length).toBe(2)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: exhibition.id } })
      await prisma.artwork.deleteMany({
        where: { id: { in: [hung1.id, hung2.id, pageOnly.id] } },
      })
    }
  })
})
