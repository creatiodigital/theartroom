import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function GET(_req: NextRequest, context: { params: Promise<{ url: string }> }) {
  try {
    const { url } = await context.params

    const exhibition = await prisma.exhibition.findUnique({
      where: { url },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            lastName: true,
            handler: true,
            biography: true,
          },
        },
        exhibitionArtworks: {
          include: {
            artwork: {
              select: {
                id: true,
                name: true,
                title: true,
                author: true,
                year: true,
                technique: true,
                dimensions: true,
                imageUrl: true,
                artworkType: true,
                hiddenFromExhibition: true,
              },
            },
          },
        },
      },
    })

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    // If exhibition is not published, only allow owner or admin/superAdmin to access
    if (!exhibition.published) {
      const session = await auth()
      const isOwner = session?.user?.id === exhibition.userId
      const userType = session?.user?.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'

      if (!isOwner && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
      }
    }

    // Extract artworks of type "image" that are not hidden from exhibition
    const artworks = exhibition.exhibitionArtworks
      .map((ea) => ea.artwork)
      .filter((artwork) => artwork.artworkType === 'image' && !artwork.hiddenFromExhibition)

    return NextResponse.json({
      ...exhibition,
      artworks,
    })
  } catch (error) {
    console.error('[GET /api/exhibitions/by-url/[url]] error:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 })
  }
}
