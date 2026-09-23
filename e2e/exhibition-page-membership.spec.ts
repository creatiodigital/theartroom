import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * The exhibition page shows what is checked into the show, not what is hung in
 * its 3D room. A work needs only its image and metadata to appear — placement
 * data is a 3D concern the grid never reads.
 *
 * Flat page: no WebGL.
 */
test.describe('the exhibition page artwork grid', () => {
  test('shows an artwork that is in the show but not hung in the room', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Page Membership',
        url: `e2e-page-membership-${stamp}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: user.id,
        name: 'E2E Unhung Work',
        title: `E2E Unhung ${stamp}`,
        slug: `e2e-unhung-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/unhung.jpg',
      },
    })
    // Member, never placed: every placement column stays null.
    await prisma.exhibitionArtwork.create({
      data: { exhibitionId: exhibition.id, artworkId: artwork.id, showOnPage: true },
    })

    try {
      await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
      await expect(page.getByText(`E2E Unhung ${stamp}`)).toBeVisible()
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })

  test('hides an artwork that is hung in the room but unchecked', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const exhibition = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Page 3D Only',
        url: `e2e-page-3donly-${stamp}`,
        spaceId: 'paris',
        status: 'published',
        published: true,
      },
    })
    const artwork = await prisma.artwork.create({
      data: {
        userId: user.id,
        name: 'E2E Hidden Work',
        title: `E2E Hidden ${stamp}`,
        slug: `e2e-hidden-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/hidden.jpg',
      },
    })
    await prisma.exhibitionArtwork.create({
      data: {
        exhibitionId: exhibition.id,
        artworkId: artwork.id,
        showOnPage: false,
        wallId: 'wall0',
        posX2d: 1, posY2d: 1, width2d: 1, height2d: 1,
        posX3d: 1, posY3d: 1, posZ3d: 1,
        quaternionX: 0, quaternionY: 0, quaternionZ: 0, quaternionW: 1,
      },
    })

    try {
      await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
      await expect(page.getByText(`E2E Hidden ${stamp}`)).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: exhibition.id } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
