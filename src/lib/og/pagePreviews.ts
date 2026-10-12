import prisma from '@/lib/prisma'
import { renderSharePreview } from '@/lib/og/sharePreview'

// Each loader reads its page's main image under the same visibility rule as
// that page's generateMetadata, so a preview never shows an image the page
// itself would hide (an unpublished exhibition or artist falls back to the
// monogram card).

export async function exhibitionSharePreview(artistSlug: string, exhibitionSlug: string) {
  const exhibition = await prisma.exhibition.findFirst({
    where: { url: exhibitionSlug, user: { handler: artistSlug }, published: true },
    select: { featuredImageUrl: true },
  })
  return renderSharePreview(exhibition?.featuredImageUrl)
}

export async function artworkSharePreview(slug: string) {
  const artwork = await prisma.artwork.findUnique({
    where: { slug },
    select: { imageUrl: true },
  })
  return renderSharePreview(artwork?.imageUrl)
}

export async function artistSharePreview(handler: string) {
  const artist = await prisma.user.findFirst({
    where: { handler, published: true },
    select: { profileImageUrl: true },
  })
  return renderSharePreview(artist?.profileImageUrl)
}
