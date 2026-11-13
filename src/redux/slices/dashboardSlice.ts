import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createDashboardState } from '@/factories/dashboardFactory'
import type { TDashboardState, TSpaceOption } from '@/types/dashboard'

// The 3D editor's panels open one at a time (editor3d.md; questions.md Q139 h). The toolbar's
// toggles close each other (Menu); the Artwork panel and a tool panel share the same place, so
// opening one closes the other here, whichever opens it (the room's double click on a work
// dispatches `showArtworkPanel`). Display only: the panels' edits stay in the store, unsaved.
const closeToolPanels = (state: TDashboardState) => {
  state.isLightingPanelOpen = false
  state.isFloorPanelOpen = false
  state.isCameraPanelOpen = false
  state.isWallCeilingPanelOpen = false
  state.isWindowsPanelOpen = false
  state.isPanelsPanelOpen = false
  state.isFurniturePanelOpen = false
  state.isBakePanelOpen = false
}

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: createDashboardState(),
  reducers: {
    showEditMode: (state: TDashboardState) => {
      state.isEditMode = true
    },
    hideEditMode: (state: TDashboardState) => {
      state.isEditMode = false
    },
    showArtworkPanel: (state: TDashboardState) => {
      closeToolPanels(state)
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
    },
    openArtworkModal: (state: TDashboardState) => {
      state.isArtworkModalOpen = true
    },
    closeArtworkModal: (state: TDashboardState) => {
      state.isArtworkModalOpen = false
    },
    showLightingPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isLightingPanelOpen = true
    },
    hideLightingPanel: (state: TDashboardState) => {
      state.isLightingPanelOpen = false
    },
    showFloorPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isFloorPanelOpen = true
    },
    hideFloorPanel: (state: TDashboardState) => {
      state.isFloorPanelOpen = false
    },
    showCameraPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isCameraPanelOpen = true
    },
    hideCameraPanel: (state: TDashboardState) => {
      state.isCameraPanelOpen = false
    },

    showWallCeilingPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isWallCeilingPanelOpen = true
    },
    hideWallCeilingPanel: (state: TDashboardState) => {
      state.isWallCeilingPanelOpen = false
    },
    showWindowsPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isWindowsPanelOpen = true
    },
    hideWindowsPanel: (state: TDashboardState) => {
      state.isWindowsPanelOpen = false
    },
    showPanelsPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isPanelsPanelOpen = true
    },
    hidePanelsPanel: (state: TDashboardState) => {
      state.isPanelsPanelOpen = false
    },
    showFurniturePanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isFurniturePanelOpen = true
    },
    hideFurniturePanel: (state: TDashboardState) => {
      state.isFurniturePanelOpen = false
    },
    showBakePanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
      state.isBakePanelOpen = true
    },
    hideBakePanel: (state: TDashboardState) => {
      state.isBakePanelOpen = false
    },
    setEditingArtwork: (state: TDashboardState, action: PayloadAction<boolean>) => {
      state.isEditingArtwork = action.payload
    },
    selectSpace: (state: TDashboardState, action: PayloadAction<TSpaceOption>) => {
      state.selectedSpace = action.payload
    },
  },
})

export const {
  showEditMode,
  hideEditMode,
  showArtworkPanel,
  hideArtworkPanel,
  openArtworkModal,
  closeArtworkModal,
  showPanelsPanel,
  hidePanelsPanel,
  showFurniturePanel,
  hideFurniturePanel,
  showLightingPanel,
  hideLightingPanel,
  showFloorPanel,
  hideFloorPanel,
  showCameraPanel,
  hideCameraPanel,

  showWallCeilingPanel,
  hideWallCeilingPanel,
  showWindowsPanel,
  hideWindowsPanel,
  showBakePanel,
  hideBakePanel,
  setEditingArtwork,
  selectSpace,
} = dashboardSlice.actions

export default dashboardSlice.reducer
