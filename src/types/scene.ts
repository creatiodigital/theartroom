import type { TWall } from './wallView'

export type TFocusTarget = {
  artworkId: string
  position: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  width: number
  height: number
}

export type TScene = {
  isArtworkPanelOpen: boolean
  isPlaceholdersShown: boolean
  isHumanVisible: boolean
  humanPositionX: number
  humanPositionZ: number
  humanRotationY: number
  currentArtworkId: string | null
  walls: TWall[]
  focusTarget: TFocusTarget | null
  /** Dynamic camera start position [x, z] from GLB initialPoint node */
  initialCameraPosition: [number, number] | null
  /** Dynamic camera look direction [x, z] from GLB initialPoint normal */
  initialCameraDirection: [number, number] | null
}
