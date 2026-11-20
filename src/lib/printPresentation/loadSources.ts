import prisma from '@/lib/prisma'

import type { PresentationSource } from './inputs'
import { isPrintPresentationRecord, type PrintPresentationRecord } from './record'

/** An artwork as the presentation code sees it: what its look depends on, and what it has stored. */
export type SourceRow = PresentationSource & {
  record: PrintPresentationRecord | null
  title: string
  artistName: string
  /** The artist's account, and its name (a work's own author line can differ). */
  artistId: string
  accountName: string
  imageUrl: string | null
  /**
   * The mandatory print size (`order: 0`) as the lab prints it: the image in cm and its border, or a
   * fixed sheet. Null for works without one (open editions). Feeds the photo views' sheet.
   */
  mandatorySize: {
    widthCm: number
    heightCm: number
    borderCm: number
    sheetWidthCm: number | null
    sheetHeightCm: number | null
  } | null
  /** The lowest unsold copy of the mandatory size (what the renders pencil), or null if none. */
  nextCopy: number | null
  /** Whether the mandatory size has its copies yet (they're created when it's published). */
  hasCopies: boolean
}

/**
 * Artworks with what their presentation depends on, in one query. The mandatory print size
 * (`order: 0`) is read whatever its state — draft, published, paused — unlike `SALE_SELECT`,
 * which only sees live sizes: pausing a size for a fix must not change how the work looks.
 */
export async function loadPresentationSources(where?: { ids?: string[] }): Promise<SourceRow[]> {
  const rows = await prisma.artwork.findMany({
    where: where?.ids ? { id: { in: where.ids } } : undefined,
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      userId: true,
      artworkType: true,
      originalWidth: true,
      originalHeight: true,
      printEnabled: true,
      editionType: true,
      printPresentation: true,
      presentationFrame: true,
      presentationPassepartout: true,
      presentationRatio: true,
      title: true,
      name: true,
      author: true,
      imageUrl: true,
      user: { select: { name: true, lastName: true } },
      limitedVariants: {
        where: { order: 0 },
        select: {
          editionSize: true,
          widthCm: true,
          heightCm: true,
          borderCm: true,
          sheetWidthCm: true,
          sheetHeightCm: true,
          editionNumbers: {
            where: { state: 'available' },
            orderBy: { number: 'asc' },
            select: { number: true },
            take: 1,
          },
          _count: { select: { editionNumbers: true } },
        },
        take: 1,
      },
    },
  })
  return rows.map((r) => {
    const variant = r.limitedVariants[0]
    return {
    id: r.id,
    artworkType: r.artworkType,
    originalWidth: r.originalWidth,
    originalHeight: r.originalHeight,
    printEnabled: r.printEnabled,
    editionType: r.editionType,
    firstVariantEditionSize: variant?.editionSize ?? null,
    presentationFrame: r.presentationFrame,
    presentationPassepartout: r.presentationPassepartout,
    presentationRatio: r.presentationRatio,
    record: isPrintPresentationRecord(r.printPresentation) ? r.printPresentation : null,
    title: r.title || r.name,
    artistName: r.author || [r.user.name, r.user.lastName].filter(Boolean).join(' '),
    artistId: r.userId,
    accountName: [r.user.name, r.user.lastName].filter(Boolean).join(' '),
    imageUrl: r.imageUrl,
    mandatorySize: variant
      ? {
          widthCm: variant.widthCm,
          heightCm: variant.heightCm,
          borderCm: variant.borderCm,
          sheetWidthCm: variant.sheetWidthCm,
          sheetHeightCm: variant.sheetHeightCm,
        }
      : null,
    nextCopy: variant?.editionNumbers[0]?.number ?? null,
    hasCopies: (variant?._count.editionNumbers ?? 0) > 0,
    }
  })
}
