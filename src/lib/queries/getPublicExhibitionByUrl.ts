import type { Prisma } from '@/generated/prisma'
import { SALE_SELECT, saleFromRow, type ArtworkSale } from '@/lib/editions/artworkSale'
import prisma from '@/lib/prisma'
import { captureError } from '@/lib/observability/captureError'

/**
 * Every artwork field the public exhibition grid renders, in ONE place.
 *
 * This page loads its artworks through two different paths — the published
 * snapshot and the live relation — and they each used to spell their select
 * out. A field added to one and forgotten in the other is invisible until a
 * priced work quietly shows no price on a published exhibition, which is the
 * only kind there is. Sharing the constant makes that impossible.
 */
const PUBLIC_ARTWORK_SELECT = {
  id: true,
  slug: true,
  name: true,
  title: true,
  author: true,
  year: true,
  technique: true,
  dimensions: true,
  imageUrl: true,
  artworkType: true,
  hiddenFromExhibition: true,
  order: true,
  ...SALE_SELECT,
} satisfies Prisma.ArtworkSelect

type PublicArtworkRow = Prisma.ArtworkGetPayload<{ select: typeof PUBLIC_ARTWORK_SELECT }>

// No data cache: read straight from the DB so curation (the Exhibitions
// checkbox), reordering and artwork metadata edits all propagate to the
// public exhibition page immediately. The page that calls this is
// force-dynamic. The 3D scene is still frozen via the exhibition's
// publishedSnapshot — that snapshot has no bearing on this query.
const getExhibition = (url: string) =>
  prisma.exhibition.findUnique({
    where: { url },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
          biography: true,
        },
      },
      exhibitionArtworks: {
        // Membership, not placement. A work with no coordinates at all belongs
        // here; a work hung in the room but unchecked does not.
        where: { showOnPage: true },
        select: {
          pageOrder: true,
          artwork: { select: PUBLIC_ARTWORK_SELECT },
        },
      },
    },
  })

export type PublicExhibitionArtwork = {
  id: string
  slug: string
  name: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  imageUrl: string | null
  originalWidth: number | null
  originalHeight: number | null
  /** What the card says about buying a print. Null = not for sale, so the card
   *  shows no commerce at all. See `resolveArtworkSale`. */
  sale: ArtworkSale | null
}

export type PublicExhibition = {
  id: string
  mainTitle: string
  shortDescription: string | null
  description: string | null
  featuredImageUrl: string | null
  url: string
  status: string
  startDate: Date | null
  endDate: Date | null
  spacePublished: boolean
  user: {
    id: string
    name: string
    lastName: string
    handler: string
    biography: string | null
  }
  artworks: PublicExhibitionArtwork[]
}

/**
 * A live row → the card's shape. The pricing inputs are resolved into `sale`
 * and dropped: `printPriceCents` is the ARTIST's cut, not a buyer-facing
 * figure, and must not cross to the client.
 */
function toPublicArtwork(row: PublicArtworkRow): PublicExhibitionArtwork {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    author: row.author,
    year: row.year,
    technique: row.technique,
    dimensions: row.dimensions,
    imageUrl: row.imageUrl,
    originalWidth: row.originalWidth,
    originalHeight: row.originalHeight,
    sale: saleFromRow(row),
  }
}

/**
 * Reads a published exhibition for the public profile page. Returns
 * `null` for missing or unpublished exhibitions so callers can map to
 * a 404 at the route boundary.
 *
 * The artwork list is live membership (`showOnPage`), not the publish-time
 * snapshot — see `loadPublicExhibition`. The snapshot still exists, but only
 * to freeze the 3D scene for /visit.
 */
export async function getPublicExhibitionByUrl(url: string): Promise<PublicExhibition | null> {
  // Report DB/read failures with flow context — they'd otherwise bubble to the
  // Next error boundary (a 500 page) with no operator signal. Re-throw so the
  // route's existing notFound/error handling is unchanged. (Observability
  // hardening for launch — see project_observability_instrumentation_map.)
  try {
    return await loadPublicExhibition(url)
  } catch (error) {
    captureError(error, {
      flow: 'content',
      stage: 'get-public-exhibition',
      level: 'error',
      fingerprint: ['content:get-public-exhibition-failed'],
      extra: { url },
    })
    throw error
  }
}

async function loadPublicExhibition(url: string): Promise<PublicExhibition | null> {
  const exhibition = await getExhibition(url)
  if (!exhibition || !exhibition.published) return null

  // Live rows only. This page used to prefer `publishedSnapshot` for its
  // artwork list, which froze the grid at publish time — a checkbox would not
  // have taken effect until the next republish. The snapshot still exists and
  // still freezes the 3D scene for /visit; it simply has no say over the page.
  const artworks = exhibition.exhibitionArtworks
    .filter((ea) => !ea.artwork.hiddenFromExhibition && ea.artwork.artworkType === 'image')
    .sort((a, b) => {
      // Per-exhibition order when the artist has set one, otherwise the
      // artist's library order. Unordered rows sink below ordered ones.
      const aOrder = a.pageOrder ?? Number.POSITIVE_INFINITY
      const bOrder = b.pageOrder ?? Number.POSITIVE_INFINITY
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.artwork.order - b.artwork.order
    })
    .map((ea) => toPublicArtwork(ea.artwork))

  return {
    id: exhibition.id,
    mainTitle: exhibition.mainTitle,
    shortDescription: exhibition.shortDescription,
    description: exhibition.description,
    featuredImageUrl: exhibition.featuredImageUrl,
    url: exhibition.url,
    status: exhibition.status,
    startDate: exhibition.startDate,
    endDate: exhibition.endDate,
    spacePublished: exhibition.spacePublished,
    user: exhibition.user,
    artworks,
  }
}
