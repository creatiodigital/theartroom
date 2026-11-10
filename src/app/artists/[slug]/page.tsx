import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtistProfilePage } from '@/components/artists/profile'
import { ArtistBiography } from '@/components/artists/profile/ArtistBiography'
import { getPublicArtistByHandler } from '@/lib/queries/getPublicArtistByHandler'

// Render per request and read straight from the DB so artist edits, new
// exhibitions and featured-artwork changes appear immediately. No data cache.
export const dynamic = 'force-dynamic'

interface ArtistProfileProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArtistProfileProps): Promise<Metadata> {
  const { slug } = await params

  // The page's own read (deduplicated per request): published artists only.
  const artist = await getPublicArtistByHandler(slug)

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
    },
  }
}

const ArtistProfile = async ({ params }: ArtistProfileProps) => {
  const { slug } = await params

  // One round-trip instead of three: artist + their published exhibitions
  // + their featured image-type artworks, each already carrying whether it is
  // for sale and at what price. The previous /api/artists, /api/exhibitions,
  // /api/artworks waterfall is collapsed here.
  const artist = await getPublicArtistByHandler(slug)

  if (!artist) notFound()

  const { exhibitions, artworks, ...artistData } = artist
  return (
    <ArtistProfilePage
      artist={artistData}
      exhibitions={exhibitions}
      artworks={artworks}
      biography={artistData.biography ? <ArtistBiography biography={artistData.biography} /> : null}
    />
  )
}

export default ArtistProfile
