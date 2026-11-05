import type { Metadata, Viewport } from 'next'

import { ExhibitionViewPage } from '@/components/exhibitions/view'
import prisma from '@/lib/prisma'

/**
 * AR-176: the room reaches every edge of the screen. Without `cover`, a phone held sideways keeps
 * the page clear of the notch and the rounded corners, and the room shows white bands at both
 * sides (Safari and Chrome alike: both are WebKit on an iPhone). The room's own buttons and panels
 * keep clear of those areas themselves (`env(safe-area-inset-*)`). This page only: every other
 * page is laid out for the safe area.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

interface ExhibitionVisitProps {
  params: Promise<{ artistSlug: string; exhibitionSlug: string }>
}

export async function generateMetadata({ params }: ExhibitionVisitProps): Promise<Metadata> {
  const { artistSlug, exhibitionSlug } = await params

  const exhibition = await prisma.exhibition.findFirst({
    where: {
      url: exhibitionSlug,
      user: { handler: artistSlug },
      published: true,
    },
    select: {
      mainTitle: true,
      user: { select: { name: true, lastName: true } },
    },
  })

  if (!exhibition) {
    return { title: 'Exhibition Not Found' }
  }

  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`

  return {
    title: { absolute: `${artistName} | ${exhibition.mainTitle} | The Art Room` },
    description: `Walk through "${exhibition.mainTitle}" by ${artistName} in an immersive 3D gallery.`,
  }
}

const ExhibitionVisit = async ({ params }: ExhibitionVisitProps) => {
  const { artistSlug, exhibitionSlug } = await params
  return <ExhibitionViewPage artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} />
}

export default ExhibitionVisit
