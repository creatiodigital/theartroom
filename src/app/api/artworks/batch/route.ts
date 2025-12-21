import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

// POST batch create artworks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, artworks } = body as {
      userId: string
      artworks: Array<{
        id: string
        name: string
        artworkType: string
        title?: string
        author?: string
        year?: string
        technique?: string
        dimensions?: string
        description?: string
        imageUrl?: string
        textContent?: string // Fixed text content for text artworks
      }>
    }

    if (!userId || !artworks || !Array.isArray(artworks)) {
      return NextResponse.json({ error: 'userId and artworks array are required' }, { status: 400 })
    }

    // Use upsert to avoid duplicates (if artwork already exists, update it)
    const results = await Promise.all(
      artworks.map((artwork) =>
        prisma.artwork.upsert({
          where: { id: artwork.id },
          create: {
            id: artwork.id,
            userId,
            name: artwork.name,
            artworkType: artwork.artworkType || 'image',
            title: artwork.title || null,
            author: artwork.author || null,
            year: artwork.year || null,
            technique: artwork.technique || null,
            dimensions: artwork.dimensions || null,
            description: artwork.description || null,
            imageUrl: artwork.imageUrl || null,
            textContent: artwork.textContent || null,
          },
          update: {
            name: artwork.name,
            artworkType: artwork.artworkType || 'image',
            title: artwork.title || null,
            author: artwork.author || null,
            year: artwork.year || null,
            technique: artwork.technique || null,
            dimensions: artwork.dimensions || null,
            description: artwork.description || null,
            imageUrl: artwork.imageUrl || null,
            textContent: artwork.textContent || null,
          },
        }),
      ),
    )

    return NextResponse.json({ count: results.length, artworks: results }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/artworks/batch] error:', error)
    return NextResponse.json({ error: 'Failed to create artworks' }, { status: 500 })
  }
}
