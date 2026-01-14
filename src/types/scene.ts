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
  currentArtworkId: string | null
  walls: TWall[]
  focusTarget: TFocusTarget | null
}
