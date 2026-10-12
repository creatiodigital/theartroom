import { NextResponse } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import { reorderByIndex } from '@/lib/reorderByIndex'

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

    // Scoping on userId enforces ownership per row: a stale or foreign id
    // simply matches nothing instead of failing the whole save.
    await reorderByIndex('Artwork', artworkIds, { column: 'userId', value: userId })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering artworks:', error)
    return NextResponse.json({ error: 'Failed to reorder artworks' }, { status: 500 })
  }
}
