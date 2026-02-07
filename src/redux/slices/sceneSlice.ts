import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { sceneFactory } from '@/factories/sceneFactory'
import type { TScene, TFocusTarget } from '@/types/scene'

const sceneSlice = createSlice({
  name: 'scene',
  initialState: sceneFactory(),
  reducers: {
    setCurrentArtwork: (state: TScene, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },

    showPlaceholders: (state: TScene) => {
      state.isPlaceholdersShown = true
    },

    hidePlaceholders: (state: TScene) => {
      state.isPlaceholdersShown = false
    },

    showHuman: (state: TScene) => {
      state.isHumanVisible = true
    },

    hideHuman: (state: TScene) => {
      state.isHumanVisible = false
    },

    addWall: (state: TScene, action: PayloadAction<{ id: string }>) => {
      const wallId = action.payload.id
      const wallIndex = state.walls.length + 1
      const readableName = `Wall ${wallIndex}`
      state.walls.push({ id: wallId, name: readableName })
    },

    editWallName: (state: TScene, action: PayloadAction<{ wallId: string; newName: string }>) => {
      const { wallId, newName } = action.payload
      const wall = state.walls.find((w) => w.id === wallId)
      if (wall) {
        wall.name = newName
      }
    },

    setFocusTarget: (state: TScene, action: PayloadAction<TFocusTarget>) => {
      state.focusTarget = action.payload
    },

    clearFocusTarget: (state: TScene) => {
      state.focusTarget = null
    },

    resetScene: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return sceneFactory()
    },
  },
})

export const {
  setCurrentArtwork,
  showPlaceholders,
  hidePlaceholders,
  showHuman,
  hideHuman,
  addWall,
  editWallName,
  setFocusTarget,
  clearFocusTarget,
  resetScene,
} = sceneSlice.actions

export default sceneSlice.reducer

