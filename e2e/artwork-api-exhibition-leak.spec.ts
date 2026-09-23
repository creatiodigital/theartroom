import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * `GET /api/artworks` serves unauthenticated callers (artist profile pages
 * are public) and joins every exhibition an artwork belongs to. Membership
 * is now a checkbox on the artwork form rather than a consequence of
 * hanging a work in a room, so a draft show's title would otherwise leak to
 * anyone who requests an artist's artwork list — no room, no publish, no
 * visibility needed. The owner (and admins) must still see their own
 * drafts; everyone else sees published shows only.
 *
 * Flat API check: no WebGL, no page render.
 */

function stamp() {
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}`
}

async function fixtureOwner() {
  return prisma.user.findUniqueOrThrow({
    where: { handler: fixtures.artistSlug },
    select: { id: true, handler: true },
  })
}

test.describe('an anonymous request for an artist artwork list', () => {
  test('sees the published exhibition title but not the draft title', async ({ request }) => {
    const owner = await fixtureOwner()
    const s = stamp()

    const published = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: `E2E Leak Published ${s}`,
        url: `e2e-leak-published-${s}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
      },
    })
    const draft = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: `E2E Leak Draft ${s}`,
        url: `e2e-leak-draft-${s}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: owner.id,
        name: 'E2E Leak Work',
        title: `E2E Leak Work ${s}`,
        slug: `e2e-leak-work-${s}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/e2e-leak.jpg',
      },
    })
    await prisma.exhibitionArtwork.createMany({
      data: [
        { exhibitionId: published.id, artworkId: artwork.id, showOnPage: true },
        { exhibitionId: draft.id, artworkId: artwork.id, showOnPage: true },
      ],
    })

    try {
      const res = await request.get(`/api/artworks?userId=${owner.id}`)
      expect(res.ok(), `request should succeed: ${res.status()} ${await res.text()}`).toBe(true)
      const body = await res.text()

      expect(body).toContain(`E2E Leak Published ${s}`)
      expect(body).not.toContain(`E2E Leak Draft ${s}`)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [published.id, draft.id] } } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})

test.describe('an authenticated request from the owning artist', () => {
  test.use({ storageState: 'e2e/.auth/artist.json' })

  test('still sees their own draft exhibition title', async ({ request }) => {
    const owner = await fixtureOwner()
    const s = stamp()

    const draft = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: `E2E Leak Owner Draft ${s}`,
        url: `e2e-leak-owner-draft-${s}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: owner.id,
        name: 'E2E Leak Owner Work',
        title: `E2E Leak Owner Work ${s}`,
        slug: `e2e-leak-owner-work-${s}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/e2e-leak-owner.jpg',
      },
    })
    await prisma.exhibitionArtwork.create({
      data: { exhibitionId: draft.id, artworkId: artwork.id, showOnPage: true },
    })

    try {
      const res = await request.get(`/api/artworks?userId=${owner.id}`)
      expect(res.ok(), `request should succeed: ${res.status()} ${await res.text()}`).toBe(true)
      const body = await res.text()

      expect(body).toContain(`E2E Leak Owner Draft ${s}`)
    } finally {
      await prisma.exhibition.delete({ where: { id: draft.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
