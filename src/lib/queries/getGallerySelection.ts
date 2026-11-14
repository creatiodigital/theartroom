import { SALE_SELECT, saleFromRow, type ArtworkSale } from '@/lib/editions/artworkSale'
import prisma from '@/lib/prisma'
import {
  getPrintPresentations,
  type PresentationView,
} from '@/lib/printPresentation/getPrintPresentations'

/**
 * The gallery's own selection — the entire contents of /prints — and its twin, Home page prints
 * (the homepage's rotating prints, `getHomePrints` below).
 *
 * Two reads, and the difference between them is the point. The public one shows
 * only what a buyer can complete right now; the admin one shows every entry with
 * the reason any of them has gone quiet, because a selection that silently
 * shrinks is one the curator cannot maintain.
 *
 * Neither restates what "currently selling" means. That lives in
 * `resolveArtworkSale`, and this consumes it.
 */

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  title: true,
  author: true,
  year: true,
  technique: true,
  dimensions: true,
  imageUrl: true,
  ...SALE_SELECT,
} as const

export type GallerySelectionCard = {
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
  /** Display name of the artist, `author` winning over the account name.
   *  Carried on the card so
   *  /prints can build its artist filter from the selection itself, with no
   *  second query and no artist in the list who has nothing on the page. */
  artistName: string
  /** The artist's page handle: /prints' "See all prints by {artist}" (prints.md). */
  artistHandler: string
  /** The account's last name: /prints orders its artist menu by it (prints.md). */
  artistLastName: string
  sale: ArtworkSale
  /** The work as a photo of the real print, when one is current and the switch is on. */
  presentation?: PresentationView | null
}

/** Why an entry is not on the page. `live` means it is. */
export type SelectionStatus = 'live' | 'sold-out' | 'not-for-sale'

export type AdminSelectionRow = {
  selectionId: string
  order: number
  status: SelectionStatus
  artwork: Omit<GallerySelectionCard, 'sale'> & { sale: ArtworkSale | null }
  artistName: string
}

/**
 * The two curated lists: Gallery selection (`SelectedPrint`, the whole of /prints) and Home page
 * prints (`HomePrint`, the homepage's rotating prints; docs/public-redesign/home.md §5). Twin
 * tables with the same shape and the same admin logic (questions Q-P2).
 */
export type CuratedList = 'prints' | 'home'

const ROW_SELECT = {
  id: true,
  order: true,
  artwork: {
    select: {
      ...CARD_SELECT,
      user: { select: { name: true, lastName: true, published: true, handler: true } },
    },
  },
} as const

const orderedRows = (list: CuratedList = 'prints') =>
  list === 'home'
    ? prisma.homePrint.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: ROW_SELECT,
      })
    : prisma.selectedPrint.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: ROW_SELECT,
      })

/**
 * Return type annotated explicitly. Left inferred, `card` picks up Prisma's
 * `title: string` (the column has a DB default, not a `?`) instead of
 * `GallerySelectionCard`'s wider `string | null` — and the `c is
 * GallerySelectionCard` predicate in `getGallerySelection` below then fails to
 * compile in both directions, since neither type is assignable to the other.
 */
function toCard(row: Awaited<ReturnType<typeof orderedRows>>[number]['artwork']): {
  card: AdminSelectionRow['artwork']
  artistName: string
} {
  const { limitedVariants, printEnabled, printPriceCents, editionType, user, ...rest } = row
  const artistName =
    rest.author?.trim() || [user.name, user.lastName].filter(Boolean).join(' ').trim()
  return {
    card: {
      ...rest,
      artistName,
      artistHandler: user.handler,
      artistLastName: user.lastName ?? '',
      // An unpublished artist's works are not for sale (checkout refuses them),
      // so the page hides them and the admin list says why.
      sale: user.published
        ? saleFromRow({
            editionType,
            printEnabled,
            printPriceCents,
            originalWidth: rest.originalWidth,
            originalHeight: rest.originalHeight,
            limitedVariants,
          })
        : null,
    },
    artistName,
  }
}

/** What /prints renders: selected works that are currently selling — sold-out
 *  editions included, shown and marked. */
export async function getGallerySelection(): Promise<GallerySelectionCard[]> {
  const rows = await orderedRows()
  // `sale != null`, NOT `minPriceCents != null`. A sold-out edition stays on the
  // page — ArtworkGrid renders it as "Sold out" instead of a CTA — because a page
  // where editions have gone is the signal that editions move. Only work that is
  // not for sale at all (prints off, unpriced, every variant paused) is hidden:
  // no story there, and the CTA would be a dead end.
  const cards = rows
    .map((row) => toCard(row.artwork).card)
    .filter((c): c is GallerySelectionCard => c.sale != null)
  const presentations = await getPrintPresentations(cards.map((c) => c.id))
  return cards.map((c) => ({ ...c, presentation: presentations[c.id] ?? null }))
}

const adminRows = async (list: CuratedList): Promise<AdminSelectionRow[]> => {
  const rows = await orderedRows(list)
  return rows.map((row) => {
    const { card, artistName } = toCard(row.artwork)
    const status: SelectionStatus =
      card.sale == null ? 'not-for-sale' : card.sale.minPriceCents == null ? 'sold-out' : 'live'
    return { selectionId: row.id, order: row.order, status, artwork: card, artistName }
  })
}

/** Every entry, with the reason any of them is hidden. */
export async function getGallerySelectionForAdmin(): Promise<AdminSelectionRow[]> {
  return adminRows('prints')
}

/**
 * One print in the homepage's Fine-art prints rotation: the work as a photo of the real print
 * (always present: works without a render are skipped) and its caption.
 */
export type HomePrintSlide = Pick<
  GallerySelectionCard,
  'id' | 'slug' | 'name' | 'title' | 'year' | 'imageUrl' | 'originalWidth' | 'originalHeight'
> & {
  artistName: string
  presentation: PresentationView
}

/**
 * What the homepage rotates: the Home page prints list, in its order, keeping only works that are
 * available to buy right now (the section sells them, so a sold-out edition is left out here,
 * unlike /prints: questions.md Q-P22) and that have a print presentation render (home.md
 * §5: skipped until rendered). FAILS QUIET: no list, no section.
 */
export async function getHomePrints(): Promise<HomePrintSlide[]> {
  const rows = await orderedRows('home')
  const cards = rows
    .map((row) => toCard(row.artwork).card)
    .filter((c): c is GallerySelectionCard => c.sale?.minPriceCents != null)
  const presentations = await getPrintPresentations(cards.map((c) => c.id))
  return cards.flatMap((c) => {
    const presentation = presentations[c.id]
    if (!presentation) return []
    return [
      {
        id: c.id,
        slug: c.slug,
        name: c.name,
        title: c.title,
        year: c.year,
        imageUrl: c.imageUrl,
        originalWidth: c.originalWidth,
        originalHeight: c.originalHeight,
        artistName: c.artistName,
        presentation,
      },
    ]
  })
}

/** A Home page prints entry: as Gallery selection's, plus whether its render is ready. */
export type AdminHomePrintRow = AdminSelectionRow & { rendered: boolean }

/** Every Home page prints entry, with why any of them is not on the homepage. */
export async function getHomePrintsForAdmin(): Promise<AdminHomePrintRow[]> {
  const rows = await adminRows('home')
  const presentations = await getPrintPresentations(rows.map((r) => r.artwork.id))
  return rows.map((row) => ({ ...row, rendered: Boolean(presentations[row.artwork.id]) }))
}
