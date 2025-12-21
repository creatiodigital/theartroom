import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET artworks for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const artworks = await prisma.artwork.findMany({
      where: { userId },
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

// POST create new artwork
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, artworkType, title, author, year, technique, dimensions, description } =
      body

    if (!userId || !name) {
      return NextResponse.json({ error: 'userId and name are required' }, { status: 400 })
    }

    const artwork = await prisma.artwork.create({
      data: {
        userId,
        name,
        artworkType: artworkType || 'image',
        title: title || null,
        author: author || null,
        year: year || null,
        technique: technique || null,
        dimensions: dimensions || null,
        description: description || null,
      },
    })

    return NextResponse.json(artwork, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artworks] error:', error)
    return NextResponse.json({ error: 'Failed to create artwork' }, { status: 500 })
  }
}
