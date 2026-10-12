import { NextResponse } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// POST reorder artworks
export async function POST(request: Request) {
  try {
    // Require authenticated user and get their ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()
    const { artworkIds } = body as { artworkIds: string[] }

    if (!Array.isArray(artworkIds)) {
      return NextResponse.json({ error: 'artworkIds must be an array' }, { status: 400 })
    }

    if (!artworkIds.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'artworkIds must be strings' }, { status: 400 })
    }

    // Persist the new order in ONE statement. The previous version ran one
    // UPDATE per artwork inside a $transaction; each costs a full round-trip
    // (functions run in iad1, the DB is in eu-west-2, ~80ms), so an artist
    // with ~60+ works blew Prisma's 5s transaction timeout (P2028) and every
    // reorder 500'd. Scoping on "userId" enforces ownership per row, and a
    // stale or foreign id simply matches nothing instead of failing the batch.
    const orders = artworkIds.map((_, index) => index)
    await prisma.$executeRaw`
      UPDATE "Artwork" AS a
      SET "order" = v.ord
      FROM unnest(${artworkIds}::text[], ${orders}::int[]) AS v(id, ord)
      WHERE a.id = v.id AND a."userId" = ${userId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering artworks:', error)
    return NextResponse.json({ error: 'Failed to reorder artworks' }, { status: 500 })
  }
}
