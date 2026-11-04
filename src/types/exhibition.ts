import type { TArtworkPosition } from '@/types/artwork'
import type { AutofocusGroup } from '@/types/autofocusGroup'
import type { ExhibitionArtworkResponse } from '@/lib/exhibitionArtworkMapper'
import type { PanelSettings } from '@/components/scene/spaces/objects/Panel/panelSettings'
import type { BenchSettings } from '@/components/scene/spaces/objects/Bench/benchSettings'
import type { BakeRecord } from '@/lib/bake/bakeRecord'
import type { PresentationView } from '@/lib/printPresentation/record'

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
  /** Present on /api/exhibitions/by-url responses: positions + artwork
   *  metadata (snapshot enriched with live fields on the public path). The
   *  visit page feeds these straight into useLoadExhibitionArtworks so it
   *  doesn't need a second /api/exhibition-artworks request. */
  exhibitionArtworks?: ExhibitionArtworkResponse[]
  status: string
  published: boolean
  hasPendingChanges: boolean
  previewEnabled: boolean
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
  recessedLampAngle?: number
  recessedLampDistance?: number
  trackLampMaterialColor?: string
  trackLampAngle?: number
  trackLampDistance?: number
  trackLampSettings?: Record<string, { rotation: number; enabled: boolean; offset?: number }>
  /** Display panels, keyed by panel index. See panelSettings.ts. */
  panelSettings?: Record<string, PanelSettings>
  /** Gallery benches, keyed by bench index. See benchSettings.ts. */
  benchSettings?: Record<string, BenchSettings>
  windowLightColor?: string
  windowLightIntensity?: number
  windowTransparency?: boolean
  /** AR-169, baked spaces: the share of the space's daylight (blinds), 0–1; unset: 1. */
  daylightLevel?: number
  /** AR-169, baked spaces: the share of the space's soft fill light, 0–1; unset: 1. */
  fillLightLevel?: number
  hdriRotation?: number
  floorReflectiveness?: number
  floorMaterial?:
    | 'concrete'
    | 'marble'
    | 'parquet'
    | 'patterned-concrete'
    | 'worn-concrete'
    | 'wood-planks'
    | 'parquet-light'
    | 'concrete-tiles'
    | 'clear-wood'
    | 'parquet-soft'
    | 'parquet-white'
    | 'dark-concrete'
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

  // Wall & Ceiling customization
  wallColor?: string
  ceilingColor?: string
  wallBrightness?: number

  // Windows
  windowFrameColor?: string
  radiatorColor?: string

  // Shadow decal controls
  shadowBlur?: number
  shadowSpread?: number
  shadowOpacity?: number
  shadowDirection?: number

  // Autofocus groups
  autofocusGroups?: AutofocusGroup[]
  /**
   * Visitor reads only (by-url): each work as a photo of the print, by artwork id, for the room's
   * pop-ups. A work without a current render is absent and shows its plain image.
   */
  presentations?: Record<string, PresentationView>

  /** AR-161: the baked light — the published bake for visitors, the draft in edit mode. */
  bake?: BakeRecord | null
  /** AR-161: the room's light fingerprint now (edit mode, admins only): a bake made from it is current. */
  bakeFingerprint?: string
  /** AR-161: only on a bake preview request: whether the draft bake matches the draft room. */
  bakeStatus?: BakeStatus
}

export type BakeStatus = 'current' | 'stale' | 'missing'
