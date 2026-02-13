export type TSpaceOption = {
  label: string
  value: 'classic' | 'modern'
}

export type TDashboardState = {
  isEditMode: boolean
  isArtworkPanelOpen: boolean
  isLightingPanelOpen: boolean
  isFloorPanelOpen: boolean
  isCameraPanelOpen: boolean
  isHumanPanelOpen: boolean
  isFurniturePanelOpen: boolean
  isEditingArtwork: boolean
  selectedSpace: TSpaceOption
}
