import type { Metadata } from 'next'

import { ArtistProfilePage } from '@/components/artists/profile'
import prisma from '@/lib/prisma'

interface ArtistProfileProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArtistProfileProps): Promise<Metadata> {
  const { slug } = await params

  const artist = await prisma.user.findFirst({
    where: { handler: slug, published: true },
    select: { name: true, lastName: true, biography: true, profileImageUrl: true },
  })

  if (!artist) {
    return { title: 'Artist Not Found' }
  }

  const artistName = `${artist.name} ${artist.lastName}`
  const description =
    artist.biography?.slice(0, 160) || `Explore exhibitions by ${artistName} at The Art Room.`

  const tabTitle = `${artistName} | The Art Room`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
      ...(artist.profileImageUrl && {
        images: [{ url: artist.profileImageUrl, alt: artistName }],
      }),
    },
  }
}

const ArtistProfile = async ({ params }: ArtistProfileProps) => {
  const { slug } = await params
  return <ArtistProfilePage slug={slug} />
}

export default ArtistProfile
