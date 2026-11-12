import type { Metadata, Viewport } from 'next'

import { ExhibitionDescription } from '@/components/exhibitions/profile/ExhibitionDescription'
import { ExhibitionViewPage } from '@/components/exhibitions/view'
import type { RoomAbout } from '@/components/exhibitions/view/RoomAbout/RoomAboutPanel'
import prisma from '@/lib/prisma'
import { getPublicExhibitionByUrl } from '@/lib/queries/getPublicExhibitionByUrl'
import { plainParagraphsOf } from '@/lib/richText/headingAnchors'
import { isRichTextEmpty } from '@/lib/textUtils'

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

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "About this exhibition" in the room menu (docs/public-redesign/room-about.md): the exhibition
 * page's own data and counting rules, read here on the server (the text is sanitized here too). Null
 * for an exhibition the public page would not show, so the room then has no such item.
 */
async function getRoomAbout(artistSlug: string, exhibitionSlug: string): Promise<RoomAbout | null> {
  const exhibition = await getPublicExhibitionByUrl(exhibitionSlug)
  if (!exhibition || exhibition.user.handler !== artistSlug) return null
  const seriesCount = exhibition.groups.filter((group) => group.title).length
  const counts = [
    exhibition.artworks.length > 0 ? count(exhibition.artworks.length, 'work', 'works') : null,
    seriesCount > 0 ? count(seriesCount, 'series', 'series') : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const artistName = `${exhibition.user.name} ${exhibition.user.lastName}`.trim()
  return {
    title: exhibition.mainTitle,
    artistName,
    counts: counts || null,
    description: isRichTextEmpty(exhibition.description) ? null : (
      <ExhibitionDescription description={exhibition.description!} />
    ),
    artist: {
      name: artistName,
      imageUrl: exhibition.user.profileImageUrl,
      biography: exhibition.user.biography ? plainParagraphsOf(exhibition.user.biography) : [],
    },
    exhibitionHref: `/exhibitions/${artistSlug}/${exhibitionSlug}`,
    artistHref: `/artists/${exhibition.user.handler}`,
  }
}

const ExhibitionVisit = async ({ params }: ExhibitionVisitProps) => {
  const { artistSlug, exhibitionSlug } = await params
  const about = await getRoomAbout(artistSlug, exhibitionSlug)
  return (
    <ExhibitionViewPage artistSlug={artistSlug} exhibitionSlug={exhibitionSlug} about={about} />
  )
}

export default ExhibitionVisit
