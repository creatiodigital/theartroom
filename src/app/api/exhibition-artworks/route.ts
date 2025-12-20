import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET exhibition artworks (positions) for an exhibition
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const exhibitionId = searchParams.get('exhibitionId')

    if (!exhibitionId) {
      return NextResponse.json({ error: 'exhibitionId is required' }, { status: 400 })
    }

    const exhibitionArtworks = await prisma.exhibitionArtwork.findMany({
      where: { exhibitionId },
      include: {
        artwork: true,
      },
    })

    return NextResponse.json(exhibitionArtworks)
  } catch (error) {
    console.error('[GET /api/exhibition-artworks] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST batch create/update exhibition artworks (positions)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { exhibitionId, positions } = body as {
      exhibitionId: string
      positions: Array<{
        artworkId: string
        wallId: string
        posX2d: number
        posY2d: number
        width2d: number
        height2d: number
        posX3d: number
        posY3d: number
        posZ3d: number
        quaternionX: number
        quaternionY: number
        quaternionZ: number
        quaternionW: number
      }>
    }

    if (!exhibitionId || !positions || !Array.isArray(positions)) {
      return NextResponse.json({ error: 'exhibitionId and positions array are required' }, { status: 400 })
    }

    // Get current artwork IDs in this exhibition
    const existingPositions = await prisma.exhibitionArtwork.findMany({
      where: { exhibitionId },
      select: { artworkId: true },
    })
    const existingArtworkIds = existingPositions.map(p => p.artworkId)

    // Find artworks that were deleted (exist in DB but not in current positions)
    const currentArtworkIds = positions.map(p => p.artworkId)
    const deletedArtworkIds = existingArtworkIds.filter(id => !currentArtworkIds.includes(id))

    // Delete removed positions
    if (deletedArtworkIds.length > 0) {
      await prisma.exhibitionArtwork.deleteMany({
        where: {
          exhibitionId,
          artworkId: { in: deletedArtworkIds },
        },
      })
    }

    // Upsert remaining positions
    const results = await Promise.all(
      positions.map((pos) =>
        prisma.exhibitionArtwork.upsert({
          where: {
            exhibitionId_artworkId: {
              exhibitionId,
              artworkId: pos.artworkId,
            },
          },
          create: {
            exhibitionId,
            artworkId: pos.artworkId,
            wallId: pos.wallId,
            posX2d: pos.posX2d,
            posY2d: pos.posY2d,
            width2d: pos.width2d,
            height2d: pos.height2d,
            posX3d: pos.posX3d,
            posY3d: pos.posY3d,
            posZ3d: pos.posZ3d,
            quaternionX: pos.quaternionX,
            quaternionY: pos.quaternionY,
            quaternionZ: pos.quaternionZ,
            quaternionW: pos.quaternionW,
          },
          update: {
            wallId: pos.wallId,
            posX2d: pos.posX2d,
            posY2d: pos.posY2d,
            width2d: pos.width2d,
            height2d: pos.height2d,
            posX3d: pos.posX3d,
            posY3d: pos.posY3d,
            posZ3d: pos.posZ3d,
            quaternionX: pos.quaternionX,
            quaternionY: pos.quaternionY,
            quaternionZ: pos.quaternionZ,
            quaternionW: pos.quaternionW,
          },
        })
      )
    )

    return NextResponse.json({ 
      count: results.length, 
      deleted: deletedArtworkIds.length 
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/exhibition-artworks] error:', error)
    return NextResponse.json({ error: 'Failed to save positions' }, { status: 500 })
  }
}
