import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { WALL_SCALE } from '@/components/wallview/constants'

import { exhibitionFactory } from '@/factories/exhibitionFactory'
import type { TArtworkPosition } from '@/types/artwork'
import type { AutofocusGroup } from '@/types/autofocusGroup'
import type { TExhibition } from '@/types/exhibition'

const HISTORY_LIMIT = 20

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

// ── Field validators ────────────────────────────────────────────────────────
// Maps field names to value transforms (clamping, normalization, etc.)
// Fields NOT listed here accept the value as-is.

type FieldValidator = (v: number) => number

const FIELD_VALIDATORS: Record<string, FieldValidator> = {
  recessedLampAngle: (v) => Math.max(0.1, Math.min(1.2, v)),
  recessedLampDistance: (v) => Math.max(1, Math.min(20, v)),
  trackLampAngle: (v) => Math.max(0.1, Math.min(1.2, v)),
  trackLampDistance: (v) => Math.max(1, Math.min(10, v)),
  floorTextureScale: (v) => Math.max(0.5, Math.min(8.0, v)),
  floorTemperature: (v) => Math.max(-1, Math.min(1, v)),
  floorNormalScale: (v) => Math.max(0, Math.min(5.0, v)),
  floorRotation: (v) => ((v % 360) + 360) % 360,
  cameraFOV: (v) => Math.max(40, Math.min(60, v)),
  cameraElevation: (v) => Math.max(1.5, Math.min(1.7, v)),
  shadowBlur: (v) => Math.max(0.01, Math.min(0.08, v)),
  shadowSpread: (v) => Math.max(0.5, Math.min(3.0, v)),
  shadowOpacity: (v) => Math.max(0.05, Math.min(0.8, v)),
  shadowDirection: (v) => Math.max(0.0, Math.min(1.0, v)),
}

// ── Slice ───────────────────────────────────────────────────────────────────

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
        // Auto-derive 3D dimensions when 2D dimensions change
        const derived: Partial<TArtworkPosition> = {}
        if (artworkPosition.width2d !== undefined) {
          derived.width3d = artworkPosition.width2d / WALL_SCALE
        }
        if (artworkPosition.height2d !== undefined) {
          derived.height3d = artworkPosition.height2d / WALL_SCALE
        }

        state.exhibitionArtworksById[artworkId] = {
          ...state.exhibitionArtworksById[artworkId],
          ...artworkPosition,
          ...derived,
        }
      }
    },

    deleteArtworkPosition: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ artworkId: string }>,
    ) => {
      const { artworkId } = action.payload
      delete state.exhibitionArtworksById[artworkId]
      state.allExhibitionArtworkIds = state.allExhibitionArtworkIds.filter((id) => id !== artworkId)

      // Dissolve any autofocus group that contained this artwork
      if (state.autofocusGroups) {
        state.autofocusGroups = state.autofocusGroups.filter(
          (g) => !g.artworkIds.includes(artworkId),
        )
      }
    },

    toggleArtworkLocked: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ artworkId: string }>,
    ) => {
      const { artworkId } = action.payload
      if (state.exhibitionArtworksById[artworkId]) {
        state.exhibitionArtworksById[artworkId].locked =
          !state.exhibitionArtworksById[artworkId].locked
      }
    },

    setExhibition: (state: TExhibitionWithHistory, action: PayloadAction<TExhibition>) => {
      // Preserve existing artwork positions only when re-setting the SAME
      // exhibition (e.g., RTK Query refetch). Switching to a different
      // exhibition must drop the previous one's positions — otherwise
      // both exhibitions' artworks render mixed in the same room.
      const isSameExhibition = state.id === action.payload.id
      const preservePositions =
        isSameExhibition &&
        state.allExhibitionArtworkIds &&
        state.allExhibitionArtworkIds.length > 0
      return {
        ...action.payload,
        ...(preservePositions
          ? {
              exhibitionArtworksById: state.exhibitionArtworksById,
              allExhibitionArtworkIds: state.allExhibitionArtworkIds,
            }
          : {}),
        _snapshot: null,
        _history: [],
        _future: [],
      }
    },

    // ── Generic field setter ──────────────────────────────────────────────
    // Replaces ~40 individual setters. Applies clamping/normalization via
    // FIELD_VALIDATORS when the field has one defined.
    setExhibitionField: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ field: keyof TExhibition; value: TExhibition[keyof TExhibition] }>,
    ) => {
      const { field, value } = action.payload
      const validator = FIELD_VALIDATORS[field as string]
      ;(state as Record<string, unknown>)[field as string] = validator
        ? validator(value as number)
        : value
    },

    // ── Track lamp per-index setters (complex, kept as-is) ────────────────

    setTrackLampRotation: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ index: number; rotation: number }>,
    ) => {
      const { index, rotation } = action.payload
      if (!state.trackLampSettings) state.trackLampSettings = {}
      if (!state.trackLampSettings[String(index)]) {
        state.trackLampSettings[String(index)] = { rotation: 0, enabled: true, offset: 0 }
      }
      state.trackLampSettings[String(index)].rotation = rotation
    },

    setTrackLampEnabled: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ index: number; enabled: boolean }>,
    ) => {
      const { index, enabled } = action.payload
      if (!state.trackLampSettings) state.trackLampSettings = {}
      if (!state.trackLampSettings[String(index)]) {
        state.trackLampSettings[String(index)] = { rotation: 0, enabled: true, offset: 0 }
      }
      state.trackLampSettings[String(index)].enabled = enabled
    },

    setTrackLampOffset: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ index: number; offset: number }>,
    ) => {
      const { index, offset } = action.payload
      if (!state.trackLampSettings) state.trackLampSettings = {}
      if (!state.trackLampSettings[String(index)]) {
        state.trackLampSettings[String(index)] = { rotation: 0, enabled: true, offset: 0 }
      }
      state.trackLampSettings[String(index)].offset = Math.max(-2, Math.min(2, offset))
    },

    // ── Autofocus group actions ────────────────────────────────────────────

    setAutofocusGroups: (
      state: TExhibitionWithHistory,
      action: PayloadAction<AutofocusGroup[]>,
    ) => {
      state.autofocusGroups = action.payload
    },

    addAutofocusGroup: (state: TExhibitionWithHistory, action: PayloadAction<AutofocusGroup>) => {
      if (!state.autofocusGroups) state.autofocusGroups = []
      state.autofocusGroups.push(action.payload)
    },

    removeAutofocusGroup: (state: TExhibitionWithHistory, action: PayloadAction<string>) => {
      if (state.autofocusGroups) {
        state.autofocusGroups = state.autofocusGroups.filter((g) => g.id !== action.payload)
      }
    },

    addArtworkToAutofocusGroup: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ groupId: string; artworkId: string }>,
    ) => {
      if (state.autofocusGroups) {
        for (const g of state.autofocusGroups) {
          if (g.id !== action.payload.groupId) {
            g.artworkIds = g.artworkIds.filter((id) => id !== action.payload.artworkId)
          }
        }
      }
      const group = state.autofocusGroups?.find((g) => g.id === action.payload.groupId)
      if (group && !group.artworkIds.includes(action.payload.artworkId)) {
        group.artworkIds.push(action.payload.artworkId)
      }
    },

    removeArtworkFromAutofocusGroup: (
      state: TExhibitionWithHistory,
      action: PayloadAction<{ groupId: string; artworkId: string }>,
    ) => {
      const group = state.autofocusGroups?.find((g) => g.id === action.payload.groupId)
      if (group) {
        group.artworkIds = group.artworkIds.filter((id) => id !== action.payload.artworkId)
      }
    },

    // ── Snapshot actions ──────────────────────────────────────────────────

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

    // ── Undo/Redo ─────────────────────────────────────────────────────────

    pushToHistory: (state: TExhibitionWithHistory) => {
      const currentState = extractExhibitionData(state)
      state._history.push(JSON.parse(JSON.stringify(currentState)))
      if (state._history.length > HISTORY_LIMIT) {
        state._history.shift()
      }
      state._future = []
    },

    undo: (state: TExhibitionWithHistory) => {
      if (state._history.length === 0) return
      const currentState = extractExhibitionData(state)
      state._future.push(JSON.parse(JSON.stringify(currentState)))
      const previousState = state._history.pop()!
      Object.assign(state, previousState)
    },

    redo: (state: TExhibitionWithHistory) => {
      if (state._future.length === 0) return
      const currentState = extractExhibitionData(state)
      state._history.push(JSON.parse(JSON.stringify(currentState)))
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
  toggleArtworkLocked,
  setExhibition,
  setExhibitionField,
  setTrackLampRotation,
  setTrackLampEnabled,
  setTrackLampOffset,
  setAutofocusGroups,
  addAutofocusGroup,
  removeAutofocusGroup,
  addArtworkToAutofocusGroup,
  removeArtworkFromAutofocusGroup,
  snapshotExhibition,
  restoreSnapshot,
  clearSnapshot,
  pushToHistory,
  undo,
  redo,
  clearHistory,
} = exhibitionSlice.actions

export default exhibitionSlice.reducer
