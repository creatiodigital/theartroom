import type { MetadataRoute } from 'next'

import prisma from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'

/**
 * Every public page a search engine should know about (AR-193). Same public rules as the pages:
 * exhibitions as /exhibitions lists them (published, not the gallery's own), artists as /artists
 * does (published artists), and the artwork pages a visitor can reach from a public page (the
 * work's artist is published, and it is featured on their page, shown on a published exhibition's
 * page, or in the Prints or homepage selection). Artwork entries carry their image, for image
 * search. No lastModified on the fixed pages: a date that changes on every request tells a crawler
 * nothing.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [exhibitions, artists, artworks] = await Promise.all([
    prisma.exhibition.findMany({
      where: { published: true, user: { userType: { notIn: ['admin', 'superAdmin'] } } },
      select: { url: true, updatedAt: true, user: { select: { handler: true } } },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { userType: 'artist', published: true },
      select: { handler: true },
    }),
    prisma.artwork.findMany({
      where: {
        artworkType: { in: ['image', 'object'] },
        user: { published: true },
        OR: [
          { featured: true },
          { selectedPrint: { isNot: null } },
          { homePrint: { isNot: null } },
          {
            hiddenFromExhibition: false,
            exhibitionArtworks: { some: { showOnPage: true, exhibition: { published: true } } },
          },
        ],
      },
      select: { slug: true, imageUrl: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/prints`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/exhibitions`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/artists`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const exhibitionPages: MetadataRoute.Sitemap = exhibitions.map((exhibition) => ({
    url: `${SITE_URL}/exhibitions/${exhibition.user.handler}/${exhibition.url}`,
    lastModified: exhibition.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const artistPages: MetadataRoute.Sitemap = artists.map((artist) => ({
    url: `${SITE_URL}/artists/${artist.handler}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const artworkPages: MetadataRoute.Sitemap = artworks.map((artwork) => ({
    url: `${SITE_URL}/artworks/${artwork.slug}`,
    lastModified: artwork.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
    ...(artwork.imageUrl && { images: [artwork.imageUrl] }),
  }))

  return [...staticPages, ...exhibitionPages, ...artistPages, ...artworkPages]
}
