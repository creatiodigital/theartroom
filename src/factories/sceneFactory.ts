import type { TScene } from '@/types/scene'

export const sceneFactory = (): TScene => ({
  isArtworkPanelOpen: false,
  isPlaceholdersShown: true,
  isHumanVisible: false,
  currentArtworkId: null,
  walls: [],
  focusTarget: null,
})

