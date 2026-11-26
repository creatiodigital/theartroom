import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'

import { ArtistProfilePage } from '@/components/artists/profile'
import { ArtistBiography } from '@/components/artists/profile/ArtistBiography'
import { getPublicArtistByHandler } from '@/lib/queries/getPublicArtistByHandler'
import { metaTextOf } from '@/lib/seo/metaText'
import { publicPageMetadata } from '@/lib/seo/pageMetadata'
import { movedArtistPath } from '@/lib/seo/slugRedirects'

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
  // The biography is the editor's HTML: read as plain text (AR-193), or it went out as "<p>Born…".
  const description =
    metaTextOf(artist.biography) || `Explore exhibitions by ${artistName} at The Art Room.`

  return publicPageMetadata({
    path: `/artists/${artist.handler}`,
    title: `${artistName} | The Art Room`,
    description,
  })
}

const ArtistProfile = async ({ params }: ArtistProfileProps) => {
  const { slug } = await params

  // One round-trip instead of three: artist + their published exhibitions
  // + their featured image-type artworks, each already carrying whether it is
  // for sale and at what price. The previous /api/artists, /api/exhibitions,
  // /api/artworks waterfall is collapsed here.
  const artist = await getPublicArtistByHandler(slug)

  // A handler that changed: on to the artist's current page (AR-193), not a 404.
  if (!artist) {
    const moved = await movedArtistPath(slug)
    if (moved) permanentRedirect(moved)
    notFound()
  }

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
