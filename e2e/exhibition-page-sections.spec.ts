import { test, expect } from '@playwright/test'

import prisma from '@/lib/prisma'

/**
 * The public exhibition page splits its grid by section: works with no section
 * first (no heading), then each section in the artist's order under its own
 * heading. An empty section shows no heading. The artwork page's previous/next
 * walks the same order.
 *
 * Flat pages: no WebGL.
 */
test('groups works under section headings in order, and arrows follow the groups', async ({
  page,
}) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { userType: 'artist', published: true },
  })
  const stamp = Date.now()
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: user.id,
      handler: user.handler,
      mainTitle: 'E2E Page Sections',
      url: `e2e-page-sections-${stamp}`,
      spaceId: 'paris',
      status: 'current',
      published: true,
    },
  })
  const [first, second, empty] = await Promise.all(
    [`E2E First ${stamp}`, `E2E Second ${stamp}`, `E2E Empty ${stamp}`].map((title, order) =>
      prisma.exhibitionSection.create({ data: { exhibitionId: exhibition.id, title, order } }),
    ),
  )
  const mkWork = (label: string) =>
    prisma.artwork.create({
      data: {
        userId: user.id,
        name: label,
        title: `${label} ${stamp}`,
        slug: `e2e-${label.toLowerCase().replace(/\s+/g, '-')}-${stamp}`,
        artworkType: 'image',
        imageUrl: 'https://example.invalid/section.jpg',
      },
    })
  const loose = await mkWork('Loose Work')
  const inFirst = await mkWork('First Work')
  const inSecond = await mkWork('Second Work')
  await prisma.exhibitionArtwork.createMany({
    data: [
      // Created in the "wrong" order on purpose — the page must not care.
      {
        exhibitionId: exhibition.id,
        artworkId: inSecond.id,
        showOnPage: true,
        sectionId: second.id,
      },
      { exhibitionId: exhibition.id, artworkId: inFirst.id, showOnPage: true, sectionId: first.id },
      { exhibitionId: exhibition.id, artworkId: loose.id, showOnPage: true },
    ],
  })

  try {
    await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)

    await expect(page.locator('[data-section-heading]')).toHaveText([first.title, second.title])
    await expect(page.getByText(empty.title)).toHaveCount(0)

    const firstRegion = page.getByRole('region', { name: first.title })
    const secondRegion = page.getByRole('region', { name: second.title })
    await expect(firstRegion.getByText(inFirst.title!)).toBeVisible()
    await expect(secondRegion.getByText(inSecond.title!)).toBeVisible()
    await expect(page.getByText(loose.title!)).toBeVisible()
    await expect(firstRegion.getByText(loose.title!)).toHaveCount(0)
    await expect(secondRegion.getByText(loose.title!)).toHaveCount(0)

    // Arrows walk loose → first section → second section.
    const context = `?exhibition=${encodeURIComponent(exhibition.url)}`
    await page.goto(`/artworks/${loose.slug}${context}`)
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveAttribute(
      'href',
      `/artworks/${inFirst.slug}${context}`,
    )
    await page.goto(`/artworks/${inFirst.slug}${context}`)
    await expect(page.getByRole('link', { name: /^Next work:/ })).toHaveAttribute(
      'href',
      `/artworks/${inSecond.slug}${context}`,
    )
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.deleteMany({ where: { id: { in: [loose.id, inFirst.id, inSecond.id] } } })
  }
})

test('an exhibition without sections renders no headings', async ({ page }) => {
  const user = await prisma.user.findFirstOrThrow({
    where: { userType: 'artist', published: true },
  })
  const stamp = Date.now()
  const exhibition = await prisma.exhibition.create({
    data: {
      userId: user.id,
      handler: user.handler,
      mainTitle: 'E2E No Sections',
      url: `e2e-no-sections-${stamp}`,
      spaceId: 'paris',
      status: 'current',
      published: true,
    },
  })
  const artwork = await prisma.artwork.create({
    data: {
      userId: user.id,
      name: 'Plain Work',
      title: `E2E Plain ${stamp}`,
      slug: `e2e-plain-${stamp}`,
      artworkType: 'image',
      imageUrl: 'https://example.invalid/plain.jpg',
    },
  })
  await prisma.exhibitionArtwork.create({
    data: { exhibitionId: exhibition.id, artworkId: artwork.id, showOnPage: true },
  })
  try {
    await page.goto(`/exhibitions/${user.handler}/${exhibition.url}`)
    await expect(page.getByText(`E2E Plain ${stamp}`)).toBeVisible()
    await expect(page.locator('[data-section-heading]')).toHaveCount(0)
  } finally {
    await prisma.exhibition.delete({ where: { id: exhibition.id } })
    await prisma.artwork.delete({ where: { id: artwork.id } })
  }
})
