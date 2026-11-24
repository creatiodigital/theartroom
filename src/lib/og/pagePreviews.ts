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
  const artwork = await prisma.artwork.findFirst({
    where: { slug, user: { published: true } },
    select: { imageUrl: true, artworkType: true, coverCropX: true, coverCropY: true },
  })
  // An Object shares its cover's square crop (docs/objects O5).
  return renderSharePreview(
    artwork?.imageUrl,
    artwork?.artworkType === 'object'
      ? { x: artwork.coverCropX, y: artwork.coverCropY }
      : undefined,
  )
}

export async function artistSharePreview(handler: string) {
  const artist = await prisma.user.findFirst({
    where: { handler, published: true },
    select: { profileImageUrl: true },
  })
  return renderSharePreview(artist?.profileImageUrl)
}
