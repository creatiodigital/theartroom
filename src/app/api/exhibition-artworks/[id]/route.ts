import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// DELETE a single exhibition-artwork relationship by its ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Verify the record exists
    const existing = await prisma.exhibitionArtwork.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Relationship not found' }, { status: 404 })
    }

    // Delete the relationship (not the artwork itself)
    await prisma.exhibitionArtwork.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('[DELETE /api/exhibition-artworks/[id]] error:', error)
    return NextResponse.json({ error: 'Failed to remove from exhibition' }, { status: 500 })
  }
}
