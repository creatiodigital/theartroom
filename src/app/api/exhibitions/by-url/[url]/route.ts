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

    // Determine if requester is the owner or an admin
    const session = await auth()
    const isOwner = session?.user?.id === exhibition.userId
    const userType = session?.user?.userType
    const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
    const isEditor = isOwner || isAdminOrAbove

    // If exhibition is not published, only allow owner or admin/superAdmin to access
    if (!exhibition.published) {
      if (!isEditor) {
        return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
      }
    }

    // --- Draft/Publish logic ---
    // mode=edit → always live data (for the edit page)
    // no mode → serve snapshot if available (for visit/public)
    const mode = _req.nextUrl.searchParams.get('mode')
    const snapshot = exhibition.publishedSnapshot as Record<string, unknown> | null

    if (exhibition.published && snapshot && mode !== 'edit') {
      // Public visitor viewing a published exhibition → return snapshot data
      const snapshotExhibition = snapshot.exhibition as Record<string, unknown>
      const snapshotArtworks = snapshot.artworks as Array<Record<string, unknown>>

      // Reconstruct the response shape from the snapshot
      const artworks = (snapshotArtworks || [])
        .map((ea) => ea.artwork as Record<string, unknown>)
        .filter((artwork) => artwork.artworkType === 'image' && !artwork.hiddenFromExhibition)

      return NextResponse.json({
        ...exhibition,
        // Override live data with snapshot data for public display
        mainTitle: snapshotExhibition.mainTitle,
        description: snapshotExhibition.description,
        shortDescription: snapshotExhibition.shortDescription,
        spaceId: snapshotExhibition.spaceId,
        thumbnailUrl: snapshotExhibition.thumbnailUrl,
        bannerUrl: snapshotExhibition.bannerUrl,
        featuredImageUrl: snapshotExhibition.featuredImageUrl,
        startDate: snapshotExhibition.startDate,
        endDate: snapshotExhibition.endDate,
        status: snapshotExhibition.status,
        user: snapshotExhibition.user,
        // Lighting
        ambientLightColor: snapshotExhibition.ambientLightColor,
        ambientLightIntensity: snapshotExhibition.ambientLightIntensity,
        skylightColor: snapshotExhibition.skylightColor,
        skylightIntensity: snapshotExhibition.skylightIntensity,
        ceilingLampColor: snapshotExhibition.ceilingLampColor,
        ceilingLampIntensity: snapshotExhibition.ceilingLampIntensity,
        trackLampColor: snapshotExhibition.trackLampColor,
        trackLampIntensity: snapshotExhibition.trackLampIntensity,
        trackLampsVisible: snapshotExhibition.trackLampsVisible,
        recessedLampColor: snapshotExhibition.recessedLampColor,
        recessedLampIntensity: snapshotExhibition.recessedLampIntensity,
        trackLampMaterialColor: snapshotExhibition.trackLampMaterialColor,
        windowLightColor: snapshotExhibition.windowLightColor,
        windowLightIntensity: snapshotExhibition.windowLightIntensity,
        // Floor
        floorReflectiveness: snapshotExhibition.floorReflectiveness,
        floorMaterial: snapshotExhibition.floorMaterial,
        floorTextureScale: snapshotExhibition.floorTextureScale,
        floorTextureOffsetX: snapshotExhibition.floorTextureOffsetX,
        floorTextureOffsetY: snapshotExhibition.floorTextureOffsetY,
        floorTemperature: snapshotExhibition.floorTemperature,
        floorNormalScale: snapshotExhibition.floorNormalScale,
        floorRotation: snapshotExhibition.floorRotation,
        // Environment & Camera
        hdriEnvironment: snapshotExhibition.hdriEnvironment,
        ceilingLightMode: snapshotExhibition.ceilingLightMode,
        cameraFOV: snapshotExhibition.cameraFOV,
        cameraElevation: snapshotExhibition.cameraElevation,
        // Artworks from snapshot
        exhibitionArtworks: snapshotArtworks,
        artworks,
      })
    }

    // Editor view OR legacy published exhibition (no snapshot) → return live data
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
