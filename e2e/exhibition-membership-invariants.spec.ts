import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * Invariants that fall between the feature tasks. Each one protects a promise
 * the design makes but no single endpoint owns.
 *
 * Flat pages only: no WebGL.
 */
test.describe('exhibition membership invariants', () => {
  test('one artwork appears on every exhibition it is checked into', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const makeExhibition = (suffix: string) =>
      prisma.exhibition.create({
        data: {
          userId: user.id,
          handler: user.handler,
          mainTitle: `E2E Shared ${suffix}`,
          url: `e2e-shared-${suffix}-${stamp}`,
          spaceId: 'paris',
          status: 'published',
          published: true,
        },
      })

    const first = await makeExhibition('one')
    const second = await makeExhibition('two')
    const artwork = await prisma.artwork.create({
      data: {
        userId: user.id,
        name: 'E2E Shared Work',
        title: `E2E Shared Work ${stamp}`,
        slug: `e2e-shared-work-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/shared.jpg',
      },
    })
    // Member of both, hung in neither. The unique constraint is per
    // exhibition, so two rows for one artwork is the supported case.
    await prisma.exhibitionArtwork.createMany({
      data: [
        { exhibitionId: first.id, artworkId: artwork.id, showOnPage: true },
        { exhibitionId: second.id, artworkId: artwork.id, showOnPage: true },
      ],
    })

    try {
      for (const exhibition of [first, second]) {
        await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
        await expect(page.getByText(`E2E Shared Work ${stamp}`)).toBeVisible()
      }
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [first.id, second.id] } } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })

  test('the artist page never lists an unpublished exhibition', async ({ page }) => {
    const user = await prisma.user.findFirstOrThrow({
      where: { userType: 'artist', published: true },
    })
    const stamp = Date.now()
    const draft = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: `E2E Draft Show ${stamp}`,
        url: `e2e-draft-show-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
        published: false,
      },
    })

    try {
      await page.goto(`/artists/${user.handler}`)
      await expect(page.getByText(`E2E Draft Show ${stamp}`)).toHaveCount(0)
    } finally {
      await prisma.exhibition.delete({ where: { id: draft.id } })
    }
  })

  test('deleting an exhibition leaves its artworks and their other shows intact', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { userType: 'artist' } })
    const stamp = Date.now()
    const doomed = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Doomed',
        url: `e2e-doomed-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const survivor = await prisma.exhibition.create({
      data: {
        userId: user.id,
        handler: user.handler,
        mainTitle: 'E2E Survivor',
        url: `e2e-survivor-${stamp}`,
        spaceId: 'paris',
        status: 'draft',
      },
    })
    const artwork = await prisma.artwork.create({
      data: { userId: user.id, name: 'E2E Survives', slug: `e2e-survives-${stamp}` },
    })
    await prisma.exhibitionArtwork.createMany({
      data: [
        { exhibitionId: doomed.id, artworkId: artwork.id, showOnPage: true },
        { exhibitionId: survivor.id, artworkId: artwork.id, showOnPage: true },
      ],
    })

    try {
      await prisma.exhibition.delete({ where: { id: doomed.id } })

      // Artworks belong to the user, never to an exhibition. Only the one
      // membership row cascades away.
      const stillThere = await prisma.artwork.findUnique({ where: { id: artwork.id } })
      expect(stillThere).not.toBeNull()

      const rows = await prisma.exhibitionArtwork.findMany({ where: { artworkId: artwork.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.exhibitionId).toBe(survivor.id)
    } finally {
      await prisma.exhibition.deleteMany({ where: { id: { in: [doomed.id, survivor.id] } } })
      await prisma.artwork.delete({ where: { id: artwork.id } })
    }
  })
})
