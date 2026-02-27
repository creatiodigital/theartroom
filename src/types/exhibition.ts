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
  published: boolean
  hasPendingChanges: boolean
  // Lighting customization
  ambientLightColor?: string
  ambientLightIntensity?: number
  skylightColor?: string
  skylightIntensity?: number
  ceilingLampColor?: string
  ceilingLampIntensity?: number
  trackLampColor?: string
  trackLampIntensity?: number
  trackLampsVisible?: boolean
  recessedLampColor?: string
  recessedLampIntensity?: number
  trackLampMaterialColor?: string
  trackLampAngle?: number
  trackLampDistance?: number
  trackLampSettings?: Record<string, { rotation: number; enabled: boolean }>
  windowLightColor?: string
  windowLightIntensity?: number
  windowTransparency?: boolean
  hdriRotation?: number
  floorReflectiveness?: number
  floorMaterial?:
    | 'concrete'
    | 'wood'
    | 'marble'
    | 'chevron'
    | 'parquet'
    | 'patterned-concrete'
    | 'worn-concrete'
  floorTextureScale?: number
  floorTextureOffsetX?: number
  floorTextureOffsetY?: number
  floorTemperature?: number
  floorNormalScale?: number
  floorRotation?: number
  // HDRI environment
  hdriEnvironment?: string
  ceilingLightMode?: string
  // Camera settings
  cameraFOV?: number
  cameraElevation?: number
  // Furniture
  benchVisible?: boolean
  benchPositionX?: number
  benchPositionZ?: number
  benchRotationY?: number
  // Wall & Ceiling customization
  wallColor?: string
  ceilingColor?: string
}
