import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'

import prisma from '@/lib/prisma'

const getCachedArtworkDetail = (id: string) =>
  unstable_cache(
    async () => {
      const artwork = await prisma.artwork.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              lastName: true,
              handler: true,
            },
          },
        },
      })

      if (!artwork) return null

      return {
        artwork: {
          id: artwork.id,
          name: artwork.name,
          title: artwork.title,
          author: artwork.author,
          year: artwork.year,
          technique: artwork.technique,
          dimensions: artwork.dimensions,
          description: artwork.description,
          imageUrl: artwork.imageUrl,
        },
        artist: artwork.user,
      }
    },
    [`artwork-detail-${id}`],
    { tags: [`artwork-${id}`], revalidate: 3600 },
  )()

// GET artwork detail with artist info
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params

    const data = await getCachedArtworkDetail(id)

    if (!data) {
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/artworks/[id]/detail] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
