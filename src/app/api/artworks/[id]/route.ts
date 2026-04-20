import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import type { NextRequest } from 'next/server'
import { deleteFromR2 } from '@/lib/r2'

import { requireOwnership } from '@/lib/authUtils'
import { FORMATS, FRAME_COLORS, MOUNTS, PAPERS, SIZES } from '@/components/PrintWizard/options'
import type { PrintOptions } from '@/components/PrintWizard/types'
import { Prisma } from '@/generated/prisma'
import prisma from '@/lib/prisma'
import { generateUniqueSlug } from '@/lib/slugify'

// Defense-in-depth: only persist printOptions whose shape matches what
// the wizard understands. Any unknown keys or unknown ids get dropped.
// Empty/all-covering dimensions are stripped — null stands for "no
// restrictions" throughout the stack.
function sanitizePrintOptions(raw: unknown): PrintOptions | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const clean = (arr: unknown, universe: readonly { id: string }[]): string[] | undefined => {
    if (!Array.isArray(arr)) return undefined
    const universeIds = new Set(universe.map((u) => u.id))
    const seen = new Set<string>()
    const out: string[] = []
    for (const item of arr) {
      if (typeof item !== 'string') continue
      if (!universeIds.has(item)) continue
      if (seen.has(item)) continue
      seen.add(item)
      out.push(item)
    }
    // An array that covers the whole universe or nothing at all is
    // equivalent to "no restriction" — return undefined so it's dropped.
    if (out.length === 0 || out.length === universe.length) return undefined
    return out
  }

  const next: PrintOptions = {}
  const paperIds = clean(obj.allowedPaperIds, PAPERS)
  const formatIds = clean(obj.allowedFormatIds, FORMATS)
  const sizeIds = clean(obj.allowedSizeIds, SIZES)
  const frameColorIds = clean(obj.allowedFrameColorIds, FRAME_COLORS)
  const mountIds = clean(obj.allowedMountIds, MOUNTS)
  if (paperIds) next.allowedPaperIds = paperIds as PrintOptions['allowedPaperIds']
  if (formatIds) next.allowedFormatIds = formatIds as PrintOptions['allowedFormatIds']
  if (sizeIds) next.allowedSizeIds = sizeIds as PrintOptions['allowedSizeIds']
  if (frameColorIds)
    next.allowedFrameColorIds = frameColorIds as PrintOptions['allowedFrameColorIds']
  if (mountIds) next.allowedMountIds = mountIds as PrintOptions['allowedMountIds']
  return Object.keys(next).length === 0 ? null : next
}

// The exhibition profile API (/api/exhibitions/by-url/[url]) caches its
// merged snapshot+live response under `exhibition-${url}` with a 1-hour
// revalidate window. Artwork edits (title, image, etc.) would otherwise
// stay invisible on the public page until that window expired — bust
// every exhibition tag that currently includes this artwork.
async function revalidateLinkedExhibitions(artworkId: string) {
  const linked = await prisma.exhibitionArtwork.findMany({
    where: { artworkId },
    select: { exhibition: { select: { url: true } } },
  })
  for (const { exhibition } of linked) {
    if (exhibition?.url) revalidateTag(`exhibition-${exhibition.url}`, 'default')
  }
}

// GET single artwork
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const artwork = await prisma.artwork.findUnique({
      where: { id },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    return NextResponse.json(artwork)
  } catch (error) {
    console.error('[GET /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT update artwork (requires auth + ownership)
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Verify ownership
    const existing = await prisma.artwork.findUnique({
      where: { id },
      select: { userId: true, title: true, slug: true },
    })
    if (!existing) return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    const { error: authError } = await requireOwnership(existing.userId)
    if (authError) return authError

    const body = await request.json()

    // Regenerate slug if title changed
    const titleChanged = body.title && body.title !== existing.title
    const slug = titleChanged ? await generateUniqueSlug(body.title) : undefined

    // Tags for cache busting below — by-id + by-slug (old + new if slug changed).
    const slugTags = [existing.slug, slug].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )

    // Normalize print-sales inputs. `printPriceCents` is an integer in
    // minor units (cents); null means "price not set". `printEnabled`
    // without a price still persists — the checkout gate checks for both.
    const rawPrice = body.printPriceCents
    const parsedPrice =
      rawPrice === null || rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice)
    const printPriceCents =
      parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0
        ? Math.round(parsedPrice)
        : null

    // Sanitize artist-set printing restrictions. Absent or non-object
    // input resets to null (no restrictions).
    const printOptions = sanitizePrintOptions(body.printOptions)

    // Base update data (fields that definitely exist)
    // Sync name with title so all consumers see the updated label
    const baseData = {
      name: body.title || body.name,
      artworkType: body.artworkType,
      title: body.title,
      ...(slug && { slug }),
      author: body.author,
      year: body.year,
      technique: body.technique,
      dimensions: body.dimensions,
      description: body.description,
      textContent: body.textContent,
      featured: body.featured === true || body.featured === 'true',
      printEnabled: body.printEnabled === true || body.printEnabled === 'true',
      printPriceCents,
      // Prisma's nullable-Json update slot doesn't accept a bare `null`
      // — the DB NULL value is signalled via Prisma.DbNull sentinel.
      printOptions:
        printOptions === null ? Prisma.DbNull : (printOptions as unknown as Prisma.InputJsonValue),
    }

    // Try with new fields first
    try {
      const artwork = await prisma.artwork.update({
        where: { id },
        data: {
          ...baseData,
          hiddenFromExhibition:
            body.hiddenFromExhibition === true || body.hiddenFromExhibition === 'true',
        },
      })

      // Bust caches that include this artwork's data
      revalidateTag(`artwork-${id}`, 'default')
      for (const s of slugTags) revalidateTag(`artwork-slug-${s}`, 'default')
      await revalidateLinkedExhibitions(id)

      return NextResponse.json(artwork)
    } catch (innerError) {
      // If new field fails, try without it (fallback for schema mismatch)
      console.warn('[PUT /api/artworks/[id]] retrying without new fields:', innerError)
      const artwork = await prisma.artwork.update({
        where: { id },
        data: baseData,
      })

      // Bust caches that include this artwork's data
      revalidateTag(`artwork-${id}`, 'default')
      for (const s of slugTags) revalidateTag(`artwork-slug-${s}`, 'default')
      await revalidateLinkedExhibitions(id)

      return NextResponse.json(artwork)
    }
  } catch (error) {
    console.error('[PUT /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to update artwork' }, { status: 500 })
  }
}

// DELETE artwork (requires auth + ownership)
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    // Get artwork first to check for image and verify ownership
    const artwork = await prisma.artwork.findUnique({
      where: { id },
    })

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    // Verify ownership
    const { error: authError } = await requireOwnership(artwork.userId)
    if (authError) return authError

    // Snapshot linked exhibition urls before the cascade wipes the
    // ExhibitionArtwork join rows — we need them to bust caches after
    // the delete completes.
    const linkedExhibitions = await prisma.exhibitionArtwork.findMany({
      where: { artworkId: id },
      select: { exhibition: { select: { url: true } } },
    })

    // Delete associated image from R2 if exists
    if (artwork.imageUrl) {
      try {
        await deleteFromR2(artwork.imageUrl)
      } catch (error) {
        console.warn('Failed to delete image blob:', error)
        // Continue anyway - file might not exist
      }
    }

    // Delete associated sound from R2 if exists
    if (artwork.soundUrl) {
      try {
        await deleteFromR2(artwork.soundUrl)
      } catch (error) {
        console.warn('Failed to delete sound blob:', error)
      }
    }

    // Delete associated video from R2 if exists
    if (artwork.videoUrl) {
      try {
        await deleteFromR2(artwork.videoUrl)
      } catch (error) {
        console.warn('Failed to delete video blob:', error)
      }
    }

    // Delete artwork record
    await prisma.artwork.delete({
      where: { id },
    })

    // Bust detail page cache + any exhibition pages that showed it
    revalidateTag(`artwork-${id}`, 'default')
    for (const { exhibition } of linkedExhibitions) {
      if (exhibition?.url) revalidateTag(`exhibition-${exhibition.url}`, 'default')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to delete artwork' }, { status: 500 })
  }
}
