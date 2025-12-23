import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createDashboardState } from '@/factories/dashboardFactory'
import type { TDashboardState, TSpaceOption } from '@/types/dashboard'

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
      state.isArtworkPanelOpen = true
    },
    hideArtworkPanel: (state: TDashboardState) => {
      state.isArtworkPanelOpen = false
    },
    showLightingPanel: (state: TDashboardState) => {
      state.isLightingPanelOpen = true
    },
    hideLightingPanel: (state: TDashboardState) => {
      state.isLightingPanelOpen = false
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
  showLightingPanel,
  hideLightingPanel,
  setEditingArtwork,
  selectSpace,
} = dashboardSlice.actions

export default dashboardSlice.reducer

