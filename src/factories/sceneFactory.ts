import type { TScene } from '@/types/scene'

export const sceneFactory = (): TScene => ({
  inArtworkView: false,
  artworkViewExitNonce: 0,
  isArtworkPanelOpen: false,
  isPlaceholdersShown: true,
  currentArtworkId: null,
  walls: [],
  focusTarget: null,
  initialCameraPosition: null,
  initialCameraDirection: null,
  isExitPromptOpen: false,
  exitPromptSource: null,
  exitRespawnNonce: 0,
  trackLampGroups: [],
})
