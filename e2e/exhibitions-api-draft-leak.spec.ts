import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * `GET /api/exhibitions` has no auth requirement of its own — the artwork
 * edit form's Exhibitions picker calls it anonymously-shaped (just a
 * `?userId=` query string) to list an artist's shows. Before this fix, that
 * meant a bare `?userId=<artistId>` returned every exhibition that artist
 * owns, published or not — a draft's `mainTitle` and `url` leaking to
 * anyone who asked, with `spacePublished`/`hasPlacedArtworks` riding along.
 *
 * The owner (and admins) must still see their own drafts — the picker
 * legitimately needs to show an artist their own unpublished shows so they
 * can curate a show before publishing it. Everyone else sees published
 * shows only.
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

test.describe('an anonymous request for an artist exhibition list', () => {
  test('sees the published exhibition title but not the draft title', async ({ request }) => {
    const owner = await fixtureOwner()
    const s = stamp()

    const published = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: `E2E Exhibitions Leak Published ${s}`,
        url: `e2e-exhibitions-leak-published-${s}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
      },
    })
    const draft = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: `E2E Exhibitions Leak Draft ${s}`,
        url: `e2e-exhibitions-leak-draft-${s}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
      },
    })

    try {
      const res = await request.get(`/api/exhibitions?userId=${owner.id}`)
      expect(res.ok(), `request should succeed: ${res.status()} ${await res.text()}`).toBe(true)
      const body = await res.text()

      expect(body).toContain(`E2E Exhibitions Leak Published ${s}`)
      expect(body).not.toContain(`E2E Exhibitions Leak Draft ${s}`)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [published.id, draft.id] } } })
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
        mainTitle: `E2E Exhibitions Leak Owner Draft ${s}`,
        url: `e2e-exhibitions-leak-owner-draft-${s}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
      },
    })

    try {
      const res = await request.get(`/api/exhibitions?userId=${owner.id}`)
      expect(res.ok(), `request should succeed: ${res.status()} ${await res.text()}`).toBe(true)
      const body = await res.text()

      expect(body).toContain(`E2E Exhibitions Leak Owner Draft ${s}`)
    } finally {
      await prisma.exhibition.delete({ where: { id: draft.id } })
    }
  })
})
