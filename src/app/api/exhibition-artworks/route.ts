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

// POST batch create/update exhibition artworks (positions and display properties)
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
        // Display properties (per-exhibition)
        showFrame?: boolean
        frameColor?: string
        frameSize?: number
        frameThickness?: number
        showPassepartout?: boolean
        passepartoutColor?: string
        passepartoutSize?: number
        passepartoutThickness?: number
        showArtworkInformation?: boolean
        // Text styling (per-exhibition)
        fontFamily?: string
        fontSize?: number
        fontWeight?: string
        letterSpacing?: number
        lineHeight?: number
        textColor?: string
        textBackgroundColor?: string
        textAlign?: string
        textVerticalAlign?: string
        textPadding?: number
      }>
    }

    if (!exhibitionId || !positions || !Array.isArray(positions)) {
      return NextResponse.json(
        { error: 'exhibitionId and positions array are required' },
        { status: 400 },
      )
    }

    // Get current artwork IDs in this exhibition
    const existingPositions = await prisma.exhibitionArtwork.findMany({
      where: { exhibitionId },
      select: { artworkId: true },
    })
    const existingArtworkIds = existingPositions.map((p) => p.artworkId)

    // Find artworks that were deleted (exist in DB but not in current positions)
    const currentArtworkIds = positions.map((p) => p.artworkId)
    const deletedArtworkIds = existingArtworkIds.filter((id) => !currentArtworkIds.includes(id))

    // Delete removed positions
    if (deletedArtworkIds.length > 0) {
      await prisma.exhibitionArtwork.deleteMany({
        where: {
          exhibitionId,
          artworkId: { in: deletedArtworkIds },
        },
      })
    }

    // Upsert remaining positions with display properties
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
            // Display properties
            showFrame: pos.showFrame ?? false,
            frameColor: pos.frameColor ?? '#000000',
            frameSize: pos.frameSize ?? 5,
            frameThickness: pos.frameThickness ?? 0.5,
            showPassepartout: pos.showPassepartout ?? false,
            passepartoutColor: pos.passepartoutColor ?? '#ffffff',
            passepartoutSize: pos.passepartoutSize ?? 10,
            passepartoutThickness: pos.passepartoutThickness ?? 0.3,
            showArtworkInformation: pos.showArtworkInformation ?? false,
            // Text display properties
            fontFamily: pos.fontFamily ?? 'Montserrat',
            fontSize: pos.fontSize ?? 16,
            fontWeight: pos.fontWeight ?? '400',
            letterSpacing: pos.letterSpacing ?? 0,
            lineHeight: pos.lineHeight ?? 1.4,
            textColor: pos.textColor ?? '#000000',
            textBackgroundColor: pos.textBackgroundColor ?? null,
            textAlign: pos.textAlign ?? 'left',
            textVerticalAlign: pos.textVerticalAlign ?? 'top',
            textPadding: pos.textPadding ?? 12,
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
            // Display properties
            showFrame: pos.showFrame ?? false,
            frameColor: pos.frameColor ?? '#000000',
            frameSize: pos.frameSize ?? 5,
            frameThickness: pos.frameThickness ?? 0.5,
            showPassepartout: pos.showPassepartout ?? false,
            passepartoutColor: pos.passepartoutColor ?? '#ffffff',
            passepartoutSize: pos.passepartoutSize ?? 10,
            passepartoutThickness: pos.passepartoutThickness ?? 0.3,
            showArtworkInformation: pos.showArtworkInformation ?? false,
            // Text display properties
            fontFamily: pos.fontFamily ?? 'Montserrat',
            fontSize: pos.fontSize ?? 16,
            fontWeight: pos.fontWeight ?? '400',
            letterSpacing: pos.letterSpacing ?? 0,
            lineHeight: pos.lineHeight ?? 1.4,
            textColor: pos.textColor ?? '#000000',
            textBackgroundColor: pos.textBackgroundColor ?? null,
            textAlign: pos.textAlign ?? 'left',
            textVerticalAlign: pos.textVerticalAlign ?? 'top',
            textPadding: pos.textPadding ?? 12,
          },
        }),
      ),
    )

    return NextResponse.json(
      {
        count: results.length,
        deleted: deletedArtworkIds.length,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/exhibition-artworks] error:', error)
    return NextResponse.json({ error: 'Failed to save positions' }, { status: 500 })
  }
}
