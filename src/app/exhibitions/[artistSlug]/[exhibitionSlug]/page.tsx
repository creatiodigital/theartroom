import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ExhibitionProfilePage } from '@/components/exhibitions/profile'
import { ExhibitionDescription } from '@/components/exhibitions/profile/ExhibitionDescription'
import { getPublicExhibitionByUrl } from '@/lib/queries/getPublicExhibitionByUrl'

// Render per request and read straight from the DB so artwork reordering and
// metadata edits show immediately (the 3D scene itself still comes from the
// published snapshot). No data cache.
export const dynamic = 'force-dynamic'

interface ExhibitionProfileProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

export async function generateMetadata({ params }: ExhibitionProfileProps): Promise<Metadata> {
  const { artistSlug, exhibitionSlug } = await params

  // The page's own read (deduplicated per request): published, and this artist's.
  const exhibition = await getPublicExhibitionByUrl(exhibitionSlug)

  if (!exhibition || exhibition.user.handler !== artistSlug) {
    return { title: 'Exhibition Not Found' }
  }

  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`
  const tabTitle = `${artistName} | ${exhibition.mainTitle} | The Art Room`
  const description =
    exhibition.shortDescription ||
    `Explore "${exhibition.mainTitle}" by ${artistName} at The Art Room.`

  return {
    title: { absolute: tabTitle },
    description,
    openGraph: {
      title: tabTitle,
      description,
    },
  }
}

const ExhibitionProfile = async ({ params }: ExhibitionProfileProps) => {
  const { artistSlug, exhibitionSlug } = await params

  const exhibition = await getPublicExhibitionByUrl(exhibitionSlug)
  if (!exhibition || exhibition.user.handler !== artistSlug) notFound()

  return (
    <ExhibitionProfilePage
      artistSlug={artistSlug}
      exhibitionSlug={exhibitionSlug}
      exhibition={exhibition}
      description={
        exhibition.description ? (
          <ExhibitionDescription description={exhibition.description} />
        ) : null
      }
    />
  )
}

export default ExhibitionProfile
