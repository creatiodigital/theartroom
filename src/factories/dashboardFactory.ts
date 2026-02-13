import type { TDashboardState } from '@/types/dashboard'

export const createDashboardState = (): TDashboardState => ({
  isEditMode: false,
  isArtworkPanelOpen: false,
  isLightingPanelOpen: false,
  isFloorPanelOpen: false,
  isCameraPanelOpen: false,
  isHumanPanelOpen: false,
  isFurniturePanelOpen: false,
  isEditingArtwork: false,
  selectedSpace: { label: 'Classic', value: 'classic' },
})
