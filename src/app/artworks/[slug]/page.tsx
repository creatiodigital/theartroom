import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtworkDetailPage } from '@/components/artwork/detail'
import prisma from '@/lib/prisma'

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

  // Existence check at the server boundary so missing artworks 404
  // properly (correct HTTP status + Next's not-found.tsx fallback)
  // instead of rendering the client component's empty state with a
  // 200. SEO + monitoring + error semantics all rely on this.
  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!artwork) notFound()

  return <ArtworkDetailPage slug={slug} />
}

export default ArtworkPage
