import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { requireSuperAdmin } from '@/lib/authUtils'
import { isArtworkPurchasable, LIVE_VARIANT_WHERE } from '@/lib/editions/printable'
import { getHomePrintsForAdmin } from '@/lib/queries/getGallerySelection'
import prisma from '@/lib/prisma'

/**
 * Home page prints (docs/public-redesign/home.md §5): the twin of /api/selected-prints, with the
 * same rules on its own table (`HomePrint`). Only the list differs: it feeds the homepage's
 * Fine-art prints section, not /prints.
 */
export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error
  return NextResponse.json(await getHomePrintsForAdmin())
}

/**
 * Batch add, as Gallery selection: anything unsellable, unknown or already in this list refuses
 * the WHOLE batch (a silently partial add leaves a list the curator did not choose). A work
 * without a print presentation render may be added: the list marks it "No render yet" and the
 * homepage skips it until it is rendered.
 */
export async function POST(request: Request) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = (await request.json()) as { artworkIds?: unknown }
  const ids = Array.isArray(body.artworkIds)
    ? body.artworkIds.filter((i) => typeof i === 'string')
    : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'artworkIds must be a non-empty array' }, { status: 400 })
  }

  const artworks = await prisma.artwork.findMany({
    where: { id: { in: ids as string[] } },
    select: {
      id: true,
      printEnabled: true,
      editionType: true,
      printPriceCents: true,
      limitedVariants: { where: LIVE_VARIANT_WHERE, select: { id: true } },
      homePrint: { select: { id: true } },
    },
  })

  if (artworks.length !== ids.length) {
    return NextResponse.json({ error: 'One or more artworks do not exist' }, { status: 400 })
  }

  const unusable = artworks.filter(
    (a) =>
      a.homePrint !== null ||
      !isArtworkPurchasable({
        printEnabled: a.printEnabled,
        editionType: a.editionType,
        printPriceCents: a.printPriceCents,
        liveVariantCount: a.limitedVariants.length,
      }),
  )
  if (unusable.length > 0) {
    return NextResponse.json(
      { error: 'One or more artworks are not currently selling, or are already in the list' },
      { status: 400 },
    )
  }

  // PREPEND in the order given, in one transaction (see /api/selected-prints).
  await prisma.$transaction([
    prisma.homePrint.updateMany({ data: { order: { increment: ids.length } } }),
    prisma.homePrint.createMany({
      data: (ids as string[]).map((artworkId, i) => ({ artworkId, order: i })),
    }),
  ])

  revalidatePath('/')
  return NextResponse.json({ added: ids.length }, { status: 201 })
}
