import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'

// Cached query for public exhibition data (snapshot path)
const getCachedExhibition = (url: string) =>
  unstable_cache(
    async () => {
      return prisma.exhibition.findUnique({
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
    },
    [`exhibition-by-url-${url}`],
    { tags: [`exhibition-${url}`], revalidate: 3600 },
  )()

export async function GET(_req: NextRequest, context: { params: Promise<{ url: string }> }) {
  try {
    const { url } = await context.params
    const mode = _req.nextUrl.searchParams.get('mode')

    // Edit mode → always fresh data, bypass cache
    if (mode === 'edit') {
      return getEditModeResponse(url)
    }

    // Public view → use cached data
    const exhibition = await getCachedExhibition(url)

    if (!exhibition) {
      return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
    }

    // If exhibition is not published, check permissions
    if (!exhibition.published) {
      const session = await auth()
      const isOwner = session?.user?.id === exhibition.userId
      const userType = session?.user?.userType
      const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
      if (!isOwner && !isAdminOrAbove) {
        return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
      }
    }

    // --- Draft/Publish logic ---
    const snapshot = exhibition.publishedSnapshot as Record<string, unknown> | null

    if (exhibition.published && snapshot) {
      // Public visitor viewing a published exhibition → return snapshot data
      const snapshotExhibition = snapshot.exhibition as Record<string, unknown>
      const snapshotArtworks = snapshot.artworks as Array<Record<string, unknown>>

      // Reconstruct the response shape from the snapshot
      const artworks = (snapshotArtworks || [])
        .map((ea) => ea.artwork as Record<string, unknown>)
        .filter((artwork) => !artwork.hiddenFromExhibition)

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
        trackLampAngle: snapshotExhibition.trackLampAngle,
        trackLampDistance: snapshotExhibition.trackLampDistance,
        windowLightColor: snapshotExhibition.windowLightColor,
        windowLightIntensity: snapshotExhibition.windowLightIntensity,
        windowTransparency: snapshotExhibition.windowTransparency,
        hdriRotation: snapshotExhibition.hdriRotation,
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
        // Furniture
        benchVisible: snapshotExhibition.benchVisible,
        benchPositionX: snapshotExhibition.benchPositionX,
        benchPositionZ: snapshotExhibition.benchPositionZ,
        benchRotationY: snapshotExhibition.benchRotationY,
        // Artworks from snapshot
        exhibitionArtworks: snapshotArtworks,
        artworks,
      })
    }

    // Legacy published exhibition (no snapshot) → return live data
    const artworks = exhibition.exhibitionArtworks
      .map((ea) => ea.artwork)
      .filter((artwork) => !artwork.hiddenFromExhibition)

    return NextResponse.json({
      ...exhibition,
      artworks,
    })
  } catch (error) {
    console.error('[GET /api/exhibitions/by-url/[url]] error:', JSON.stringify(error, null, 2))
    return NextResponse.json({ error: 'Failed to fetch exhibition' }, { status: 500 })
  }
}

// Edit mode: always fresh, never cached
async function getEditModeResponse(url: string) {
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

  // Check permissions for edit mode
  const session = await auth()
  const isOwner = session?.user?.id === exhibition.userId
  const userType = session?.user?.userType
  const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'

  if (!isOwner && !isAdminOrAbove) {
    return NextResponse.json({ error: 'Exhibition not found' }, { status: 404 })
  }

  const artworks = exhibition.exhibitionArtworks
    .map((ea) => ea.artwork)
    .filter((artwork) => !artwork.hiddenFromExhibition)

  return NextResponse.json({
    ...exhibition,
    artworks,
  })
}
