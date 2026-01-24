import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { exhibitionFactory } from '@/factories/exhibitionFactory'
import type { TArtworkPosition } from '@/types/artwork'
import type { TExhibition } from '@/types/exhibition'

const HISTORY_LIMIT = 5

// Extended state type to include snapshot and history
type TExhibitionWithHistory = TExhibition & {
  _snapshot: TExhibition | null
  _history: TExhibition[] // Past states for undo
  _future: TExhibition[] // Future states for redo
}

const createInitialState = (): TExhibitionWithHistory => ({
  ...exhibitionFactory(),
  _snapshot: null,
  _history: [],
  _future: [],
})

// Helper to extract exhibition data without internal fields
const extractExhibitionData = (state: TExhibitionWithHistory): TExhibition => {
  const { _snapshot, _history, _future, ...exhibition } = state
  return exhibition as TExhibition
}

const exhibitionSlice = createSlice({
  name: 'exhibition',
  initialState: createInitialState(),
  reducers: {
    createArtworkPosition: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ artworkId: string; artworkPosition: TArtworkPosition }>,
    ) => {
      const { artworkId, artworkPosition } = action.payload

      if (!state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId] = artworkPosition

        if (!state.allExhibitionArtworkIds.includes(artworkId)) {
          state.allExhibitionArtworkIds.push(artworkId)
        }
      }
    },

    updateArtworkPosition: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ artworkId: string; artworkPosition: Partial<TArtworkPosition> }>,
    ) => {
      const { artworkId, artworkPosition } = action.payload

      if (state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId] = {
          ...state.exhibitionArtworksById[artworkId],
          ...artworkPosition,
        }
      }
    },

    deleteArtworkPosition: (state: TExhibitionWithHistory, action: PayloadAction<{ artworkId: string }>) => {
      const { artworkId } = action.payload
      delete state.exhibitionArtworksById[artworkId]
      state.allExhibitionArtworkIds = state.allExhibitionArtworkIds.filter((id) => id !== artworkId)
    },

    setExhibition: (_state: TExhibitionWithHistory, action: PayloadAction<TExhibition>) => {
      return { ...action.payload, _snapshot: null, _history: [], _future: [] }
    },

    // Lighting customization actions
    setAmbientLightColor: (state: TExhibitionWithHistory, action: PayloadAction<string>) => {
      state.ambientLightColor = action.payload
    },

    setAmbientLightIntensity: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.ambientLightIntensity = action.payload
    },

    setSkylightColor: (state: TExhibitionWithHistory, action: PayloadAction<string>) => {
      state.skylightColor = action.payload
    },

    setSkylightIntensity: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.skylightIntensity = action.payload
    },

    setCeilingLampColor: (state: TExhibitionWithHistory, action: PayloadAction<string>) => {
      state.ceilingLampColor = action.payload
    },

    setCeilingLampIntensity: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.ceilingLampIntensity = action.payload
    },

    setWindowLightColor: (state: TExhibitionWithHistory, action: PayloadAction<string>) => {
      state.windowLightColor = action.payload
    },

    setWindowLightIntensity: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.windowLightIntensity = action.payload
    },

    setFloorReflectiveness: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.floorReflectiveness = action.payload
    },

    setFloorMaterial: (state: TExhibitionWithHistory, action: PayloadAction<'concrete' | 'wood'>) => {
      state.floorMaterial = action.payload
    },

    setFloorTextureScale: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      // Clamp scale between 0.45 and 2.0
      state.floorTextureScale = Math.max(0.45, Math.min(2.0, action.payload))
    },

    setFloorTextureOffsetX: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.floorTextureOffsetX = action.payload
    },

    setFloorTextureOffsetY: (state: TExhibitionWithHistory, action: PayloadAction<number>) => {
      state.floorTextureOffsetY = action.payload
    },

    // Snapshot actions for cancel functionality
    snapshotExhibition: (state: TExhibitionWithHistory) => {
      state._snapshot = extractExhibitionData(state)
    },

    restoreSnapshot: (state: TExhibitionWithHistory) => {
      if (state._snapshot) {
        const snapshot = state._snapshot
        Object.assign(state, snapshot)
        state._snapshot = null
        state._history = []
        state._future = []
      }
    },

    clearSnapshot: (state: TExhibitionWithHistory) => {
      state._snapshot = null
    },

    // Undo/Redo history actions
    pushToHistory: (state: TExhibitionWithHistory) => {
      // Save current state to history before making changes
      const currentState = extractExhibitionData(state)
      state._history.push(JSON.parse(JSON.stringify(currentState)))
      
      // Limit history size
      if (state._history.length > HISTORY_LIMIT) {
        state._history.shift()
      }
      
      // Clear future on new action (can't redo after new action)
      state._future = []
    },

    undo: (state: TExhibitionWithHistory) => {
      if (state._history.length === 0) return

      // Save current state to future for redo
      const currentState = extractExhibitionData(state)
      state._future.push(JSON.parse(JSON.stringify(currentState)))

      // Pop last state from history and restore it
      const previousState = state._history.pop()!
      Object.assign(state, previousState)
    },

    redo: (state: TExhibitionWithHistory) => {
      if (state._future.length === 0) return

      // Save current state to history for undo
      const currentState = extractExhibitionData(state)
      state._history.push(JSON.parse(JSON.stringify(currentState)))

      // Pop last state from future and restore it
      const nextState = state._future.pop()!
      Object.assign(state, nextState)
    },

    clearHistory: (state: TExhibitionWithHistory) => {
      state._history = []
      state._future = []
    },
  },
})

export const {
  createArtworkPosition,
  updateArtworkPosition,
  deleteArtworkPosition,
  setExhibition,
  setAmbientLightColor,
  setAmbientLightIntensity,
  setSkylightColor,
  setSkylightIntensity,
  setCeilingLampColor,
  setCeilingLampIntensity,
  setWindowLightColor,
  setWindowLightIntensity,
  setFloorReflectiveness,
  setFloorMaterial,
  setFloorTextureScale,
  setFloorTextureOffsetX,
  setFloorTextureOffsetY,
  snapshotExhibition,
  restoreSnapshot,
  clearSnapshot,
  pushToHistory,
  undo,
  redo,
  clearHistory,
} = exhibitionSlice.actions

export default exhibitionSlice.reducer

