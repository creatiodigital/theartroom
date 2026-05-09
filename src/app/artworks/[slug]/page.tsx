import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import type { Metadata } from 'next'

import { ArtworkDetailPage } from '@/components/artwork/detail'
import prisma from '@/lib/prisma'

// Same cache tag the /api/artworks/by-slug route uses — existing
// revalidateTag calls in write paths invalidate both surfaces.
const getCachedArtwork = (slug: string) =>
  unstable_cache(
    () =>
      prisma.artwork.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          name: true,
          title: true,
          author: true,
          year: true,
          technique: true,
          dimensions: true,
          description: true,
          imageUrl: true,
          originalWidth: true,
          originalHeight: true,
          printEnabled: true,
          printPriceCents: true,
          user: {
            select: {
              id: true,
              name: true,
              lastName: true,
              handler: true,
            },
          },
        },
      }),
    [`artwork-page-by-slug-${slug}`],
    { tags: [`artwork-slug-${slug}`], revalidate: 3600 },
  )()

interface ArtworkPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      imageUrl: true,
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!artwork) {
    return { title: 'Artwork Not Found' }
  }

  const artistName = `${artwork.user.name} ${artwork.user.lastName}`
  const tabTitle = `${artistName} | ${artwork.title}`
  const description = artwork.description?.slice(0, 160) || `"${artwork.title}" by ${artistName}.`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
      ...(artwork.imageUrl && {
        images: [{ url: artwork.imageUrl, alt: tabTitle }],
      }),
    },
  }
}

const ArtworkPage = async ({ params }: ArtworkPageProps) => {
  const { slug } = await params

  const artwork = await getCachedArtwork(slug)
  if (!artwork) notFound()

  const { user, ...artworkData } = artwork
  return <ArtworkDetailPage artwork={artworkData} artist={user} />
}

export default ArtworkPage
