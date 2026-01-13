import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getEffectiveUserId } from '@/lib/authUtils'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET artworks for a user (public - needed for artist profiles)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const artworkType = searchParams.get('artworkType')
    const featured = searchParams.get('featured')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const artworks = await prisma.artwork.findMany({
      where: {
        userId,
        ...(artworkType && { artworkType }),
        ...(featured === 'true' && { featured: true }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        exhibitionArtworks: {
          include: {
            exhibition: {
              select: { id: true, mainTitle: true },
            },
          },
        },
      },
    })

    return NextResponse.json(artworks)
  } catch (error) {
    console.error('[GET /api/artworks] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create new artwork (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require authentication and get effective user ID
    const { userId, error: authError } = await getEffectiveUserId()
    if (authError) return authError

    const body = await request.json()
    const {
      artworkType,
      title,
      author,
      year,
      technique,
      dimensions,
      description,
      featured,
    } = body

    // Auto-generate title if not provided
    let finalTitle = title
    if (!finalTitle || finalTitle.trim() === '') {
      // Count existing artworks to generate "Untitled 1", "Untitled 2", etc.
      const count = await prisma.artwork.count({
        where: { userId },
      })
      finalTitle = `Untitled ${count + 1}`
    }

    const artwork = await prisma.artwork.create({
      data: {
        userId,
        name: finalTitle, // Use title as name for backwards compatibility
        artworkType: artworkType || 'image',
        title: finalTitle,
        author: author || null,
        year: year || null,
        technique: technique || null,
        dimensions: dimensions || null,
        description: description || null,
        featured: featured === true || featured === 'true',
      },
    })

    return NextResponse.json(artwork, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artworks] error:', error)
    console.error('[POST /api/artworks] error details:', JSON.stringify(error, null, 2))
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create artwork', details: errorMessage }, { status: 500 })
  }
}
