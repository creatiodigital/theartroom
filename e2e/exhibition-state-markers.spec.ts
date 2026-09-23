import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

import { fixtures } from './fixtures'

/**
 * The admin exhibitions list marks a state that's easy to leave half-done:
 * a published show with work already hung in its 3D room, but the room
 * itself still switched off. Legitimate right after the artist finishes
 * hanging and before they flip the room on — but rare enough that it should
 * read as a deliberate marker, not sit silently invisible.
 *
 * (The companion wall-editor marker — a work hung but curated off the
 * exhibition page — is verified by hand: the wall editor is WebGL and is
 * never mounted in a test.)
 *
 * Flat page only: the admin list is a server-rendered table, no WebGL.
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

test.describe('the admin exhibitions list and a built-but-dark 3D room', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('shows the marker while spacePublished is false, hides it once switched on', async ({
    page,
  }) => {
    const owner = await fixtureOwner()
    const s = stamp()
    const title = `E2E Room Ready ${s}`

    const exhibition = await prisma.exhibition.create({
      data: {
        userId: owner.id,
        handler: owner.handler,
        mainTitle: title,
        url: `e2e-room-ready-${s}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
        spacePublished: false,
      },
    })
    const artwork = await prisma.artwork.create({
      data: { userId: owner.id, name: 'E2E Room Ready Work', slug: `e2e-room-ready-work-${s}` },
    })
    // A placed row — wallId set, full placement columns filled — is what
    // makes the room "built". A membership-only row (no wallId) must not
    // trip the marker.
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
      await page.goto('/admin/exhibitions')
      const row = page.locator('tr', { hasText: title })
      await expect(row.getByText('3D room ready')).toBeVisible()

      await prisma.exhibition.update({
        where: { id: exhibition.id },
        data: { spacePublished: true },
      })
      await page.reload()
      const rowAfter = page.locator('tr', { hasText: title })
      await expect(rowAfter.getByText('3D room ready')).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
