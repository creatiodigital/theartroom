import type { MetadataRoute } from 'next'

import prisma from '@/lib/prisma'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [exhibitions, artists] = await Promise.all([
    prisma.exhibition.findMany({
      where: { published: true },
      select: {
        url: true,
        publishedAt: true,
        user: { select: { handler: true } },
      },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { published: true },
      select: { handler: true },
    }),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    {
      url: `${SITE_URL}/exhibitions`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/artists`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  const exhibitionPages: MetadataRoute.Sitemap = exhibitions.map((exhibition) => ({
    url: `${SITE_URL}/exhibitions/${exhibition.user.handler}/${exhibition.url}`,
    lastModified: exhibition.publishedAt || new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const artistPages: MetadataRoute.Sitemap = artists.map((artist) => ({
    url: `${SITE_URL}/artists/${artist.handler}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticPages, ...exhibitionPages, ...artistPages]
}
