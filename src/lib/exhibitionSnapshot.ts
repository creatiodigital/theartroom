import prisma from '@/lib/prisma'

/**
 * Build a publishable snapshot of an exhibition's current state.
 * Captures all exhibition settings + artwork positions + artwork metadata.
 */
export async function buildExhibitionSnapshot(exhibitionId: string) {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id: exhibitionId },
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
              textContent: true,
              hiddenFromExhibition: true,
            },
          },
        },
      },
    },
  })

  if (!exhibition) {
    throw new Error(`Exhibition ${exhibitionId} not found`)
  }

  // Build the snapshot — includes everything the public viewer needs
  const { exhibitionArtworks, ...exhibitionData } = exhibition

  return {
    exhibition: {
      mainTitle: exhibitionData.mainTitle,
      description: exhibitionData.description,
      shortDescription: exhibitionData.shortDescription,
      url: exhibitionData.url,
      handler: exhibitionData.handler,
      thumbnailUrl: exhibitionData.thumbnailUrl,
      bannerUrl: exhibitionData.bannerUrl,
      featuredImageUrl: exhibitionData.featuredImageUrl,
      spaceId: exhibitionData.spaceId,
      startDate: exhibitionData.startDate,
      endDate: exhibitionData.endDate,
      status: exhibitionData.status,
      // User info
      user: exhibitionData.user,
      // Lighting
      ambientLightColor: exhibitionData.ambientLightColor,
      ambientLightIntensity: exhibitionData.ambientLightIntensity,
      skylightColor: exhibitionData.skylightColor,
      skylightIntensity: exhibitionData.skylightIntensity,
      ceilingLampColor: exhibitionData.ceilingLampColor,
      ceilingLampIntensity: exhibitionData.ceilingLampIntensity,
      trackLampColor: exhibitionData.trackLampColor,
      trackLampIntensity: exhibitionData.trackLampIntensity,
      trackLampsVisible: exhibitionData.trackLampsVisible,
      recessedLampColor: exhibitionData.recessedLampColor,
      recessedLampIntensity: exhibitionData.recessedLampIntensity,
      trackLampMaterialColor: exhibitionData.trackLampMaterialColor,
      windowLightColor: exhibitionData.windowLightColor,
      windowLightIntensity: exhibitionData.windowLightIntensity,
      windowTransparency: exhibitionData.windowTransparency,
      hdriRotation: exhibitionData.hdriRotation,
      // Floor
      floorReflectiveness: exhibitionData.floorReflectiveness,
      floorMaterial: exhibitionData.floorMaterial,
      floorTextureScale: exhibitionData.floorTextureScale,
      floorTextureOffsetX: exhibitionData.floorTextureOffsetX,
      floorTextureOffsetY: exhibitionData.floorTextureOffsetY,
      floorTemperature: exhibitionData.floorTemperature,
      floorNormalScale: exhibitionData.floorNormalScale,
      floorRotation: exhibitionData.floorRotation,
      // Environment
      hdriEnvironment: exhibitionData.hdriEnvironment,
      ceilingLightMode: exhibitionData.ceilingLightMode,
      // Camera
      cameraFOV: exhibitionData.cameraFOV,
      cameraElevation: exhibitionData.cameraElevation,
      // Wall & Ceiling
      wallColor: exhibitionData.wallColor,
      ceilingColor: exhibitionData.ceilingColor,
    },
    artworks: exhibitionArtworks.map((ea) => ({
      id: ea.id,
      artworkId: ea.artworkId,
      wallId: ea.wallId,
      posX2d: ea.posX2d,
      posY2d: ea.posY2d,
      width2d: ea.width2d,
      height2d: ea.height2d,
      posX3d: ea.posX3d,
      posY3d: ea.posY3d,
      posZ3d: ea.posZ3d,
      quaternionX: ea.quaternionX,
      quaternionY: ea.quaternionY,
      quaternionZ: ea.quaternionZ,
      quaternionW: ea.quaternionW,
      // Display properties
      showFrame: ea.showFrame,
      frameColor: ea.frameColor,
      frameSize: ea.frameSize,
      frameThickness: ea.frameThickness,
      showPassepartout: ea.showPassepartout,
      passepartoutColor: ea.passepartoutColor,
      passepartoutSize: ea.passepartoutSize,
      passepartoutThickness: ea.passepartoutThickness,
      showSupport: ea.showSupport,
      supportThickness: ea.supportThickness,
      supportColor: ea.supportColor,
      hideShadow: ea.hideShadow,
      showArtworkInformation: ea.showArtworkInformation,
      // Text styling
      fontFamily: ea.fontFamily,
      fontSize: ea.fontSize,
      fontWeight: ea.fontWeight,
      letterSpacing: ea.letterSpacing,
      lineHeight: ea.lineHeight,
      textColor: ea.textColor,
      textBackgroundColor: ea.textBackgroundColor,
      textAlign: ea.textAlign,
      textVerticalAlign: ea.textVerticalAlign,
      textPadding: ea.textPadding,
      // Artwork metadata
      artwork: ea.artwork,
    })),
  }
}
