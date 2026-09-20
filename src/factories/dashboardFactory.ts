import type { TDashboardState } from '@/types/dashboard'

export const createDashboardState = (): TDashboardState => ({
  isEditMode: false,
  isArtworkPanelOpen: false,
  isArtworkModalOpen: false,
  isLightingPanelOpen: false,
  isFloorPanelOpen: false,
  isCameraPanelOpen: false,

  isWallCeilingPanelOpen: false,
  isPanelsPanelOpen: false,
  isEditingArtwork: false,
  selectedSpace: { label: 'Paris', value: 'paris' },
})
