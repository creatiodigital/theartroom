import type { TArtworkPosition } from '@/types/artwork'

export type TExhibition = {
  id: string
  userId: string
  name: string
  mainTitle: string
  url: string
  thumbnailUrl: string
  spaceId: string
  bannerUrl: string
  startDate: string
  endDate: string
  exhibitionArtworksById: Record<string, TArtworkPosition>
  allExhibitionArtworkIds: string[]
  status: string
  visibility: string
  // Lighting customization
  ambientLightColor?: string
  ambientLightIntensity?: number
  skylightColor?: string
  skylightIntensity?: number
  ceilingLampColor?: string
  ceilingLampIntensity?: number
  windowLightColor?: string
  windowLightIntensity?: number
  floorReflectiveness?: number
  floorMaterial?: 'concrete' | 'wood'
  floorTextureScale?: number
  floorTextureOffsetX?: number
  floorTextureOffsetY?: number
}

