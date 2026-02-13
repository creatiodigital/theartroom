import { NextResponse } from 'next/server'

import { requireAuth } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

// POST reorder artworks
export async function POST(request: Request) {
  try {
    // Require authenticated user
    const { error: authError } = await requireAuth()
    if (authError) return authError

    const body = await request.json()
    const { artworkIds } = body as { artworkIds: string[] }

    if (!Array.isArray(artworkIds)) {
      return NextResponse.json({ error: 'artworkIds must be an array' }, { status: 400 })
    }

    // Update each artwork's order based on its position in the array
    await prisma.$transaction(
      artworkIds.map((id, index) =>
        prisma.artwork.update({
          where: { id },
          data: { order: index },
        }),
      ),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering artworks:', error)
    return NextResponse.json({ error: 'Failed to reorder artworks' }, { status: 500 })
  }
}
