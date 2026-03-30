import type { Metadata } from 'next'

import { ExhibitionViewPage } from '@/components/exhibitions/view'
import prisma from '@/lib/prisma'

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
