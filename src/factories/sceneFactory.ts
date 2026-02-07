import type { TScene } from '@/types/scene'

export const sceneFactory = (): TScene => ({
  isArtworkPanelOpen: false,
  isPlaceholdersShown: true,
  isHumanVisible: false,
  humanPositionX: 0,
  humanPositionZ: 0,
  humanRotationY: 0,
  currentArtworkId: null,
  walls: [],
  focusTarget: null,
})

