import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { createNewArtwork } from '@/factories/artworkFactory'
import type { TArtwork, TArtworkKind } from '@/types/artwork'

interface TArtworksState {
  byId: Record<string, TArtwork>
  allIds: string[]
  artworkCounters: Record<TArtworkKind, number>
  _snapshot: {
    byId: Record<string, TArtwork>
    allIds: string[]
    artworkCounters: Record<TArtworkKind, number>
  } | null
}

const initialState: TArtworksState = {
  byId: {},
  allIds: [],
  artworkCounters: {
    image: 0,
    text: 0,
    sound: 0,
    shape: 0,
  },
  _snapshot: null,
}

const artworkSlice = createSlice({
  name: 'artworks',
  initialState,
  reducers: {
    createArtwork: (state, action: PayloadAction<{ id: string; artworkType: TArtworkKind }>) => {
      const { id, artworkType } = action.payload

      state.artworkCounters[artworkType] = (state.artworkCounters[artworkType] ?? 0) + 1

      const newArtwork = createNewArtwork({ id, artworkType })
      const defaultName = `${artworkType.charAt(0).toUpperCase() + artworkType.slice(1)} ${
        state.artworkCounters[artworkType]
      }`
      newArtwork.name = defaultName
      newArtwork.artworkTitle = defaultName // Set default title to match name

      state.byId[id] = newArtwork
      state.allIds.push(id)
    },

    // Restore artwork from database with all metadata
    restoreArtwork: (state, action: PayloadAction<TArtwork>) => {
      const artwork = action.payload

      // Don't increment counters for restored artworks
      if (!state.allIds.includes(artwork.id)) {
        state.allIds.push(artwork.id)
      }

      state.byId[artwork.id] = artwork
    },

    editArtwork: <K extends keyof TArtwork>(
      state: TArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]
      if (artwork) {
        artwork[property] = value
      }
    },

    editArtisticImage: <K extends keyof TArtwork>(
      state: TArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]

      if (artwork?.artworkType === 'image' || artwork?.artworkType === 'sound') {
        artwork[property] = value
      }
    },

    editArtisticText: <K extends keyof TArtwork>(
      state: TArtworksState,
      action: PayloadAction<{ currentArtworkId: string; property: K; value: TArtwork[K] }>,
    ) => {
      const { currentArtworkId, property, value } = action.payload
      const artwork = state.byId[currentArtworkId]

      if (artwork?.artworkType === 'text') {
        artwork[property] = value
      }
    },

    deleteArtwork: (state, action: PayloadAction<{ artworkId: string }>) => {
      const { artworkId } = action.payload
      delete state.byId[artworkId]
      state.allIds = state.allIds.filter((id) => id !== artworkId)
    },

    resetArtworks: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return initialState
    },

    // Snapshot actions for cancel functionality
    snapshotArtworks: (state) => {
      state._snapshot = {
        byId: JSON.parse(JSON.stringify(state.byId)),
        allIds: [...state.allIds],
        artworkCounters: { ...state.artworkCounters },
      }
    },

    restoreArtworksSnapshot: (state) => {
      if (state._snapshot) {
        // Return a new state object to ensure Immer properly updates
        return {
          byId: state._snapshot.byId,
          allIds: state._snapshot.allIds,
          artworkCounters: state._snapshot.artworkCounters,
          _snapshot: null,
        }
      }
    },

    clearArtworksSnapshot: (state) => {
      state._snapshot = null
    },
  },
})

export const {
  createArtwork,
  restoreArtwork,
  editArtwork,
  editArtisticImage,
  editArtisticText,
  deleteArtwork,
  resetArtworks,
  snapshotArtworks,
  restoreArtworksSnapshot,
  clearArtworksSnapshot,
} = artworkSlice.actions

export default artworkSlice.reducer
