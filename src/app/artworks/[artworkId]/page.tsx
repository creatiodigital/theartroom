import type { Metadata } from 'next'

import { ArtworkDetailPage } from '@/components/artwork/detail'
import prisma from '@/lib/prisma'

interface ArtworkPageProps {
  params: Promise<{ artworkId: string }>
  searchParams: Promise<{ ref?: string }>
}

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { artworkId } = await params

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
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

const ArtworkPage = async ({ params, searchParams }: ArtworkPageProps) => {
  const { artworkId } = await params
  const { ref } = await searchParams
  const isInternal = ref === 'internal'

  return <ArtworkDetailPage artworkId={artworkId} isInternal={isInternal} />
}

export default ArtworkPage
