import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * The Floor view (docs/objects O6) and the room's Object info. The floor itself lives on the
 * exhibition (`exhibition.floorLayout`); this is only what is open and what is picked.
 */
type FloorState = {
  /** The Floor view is open, on this room. */
  isFloorView: boolean
  room: number
  /** The picked items' ids (the first one leads). */
  selectedIds: string[]
  /** An Object's info open over the visitor's room: its artwork slug. */
  openObjectSlug: string | null
  /** The Floor view's helpers (the board's switches). */
  helpers: FloorHelpers
}

export type FloorHelpers = {
  /** Snap to edges, centres and walls while dragging. */
  snapAlign: boolean
  /** Objects stick to a pedestal's top. */
  snapPedestals: boolean
  /** A 1.70 m figure in the room. */
  person: boolean
  /** Rulers along the plan. */
  rulers: boolean
}

const initialState: FloorState = {
  isFloorView: false,
  room: 0,
  selectedIds: [],
  openObjectSlug: null,
  helpers: { snapAlign: true, snapPedestals: true, person: false, rulers: false },
}

const floorSlice = createSlice({
  name: 'floor',
  initialState,
  reducers: {
    showFloorView: (state, action: PayloadAction<{ room: number }>) => {
      state.isFloorView = true
      state.room = action.payload.room
      state.selectedIds = []
    },
    hideFloorView: (state) => {
      state.isFloorView = false
      state.selectedIds = []
    },
    setFloorRoom: (state, action: PayloadAction<number>) => {
      state.room = action.payload
      state.selectedIds = []
    },
    selectFloorItems: (state, action: PayloadAction<string[]>) => {
      state.selectedIds = action.payload
    },
    openFloorObject: (state, action: PayloadAction<string>) => {
      state.openObjectSlug = action.payload
    },
    closeFloorObject: (state) => {
      state.openObjectSlug = null
    },
    setFloorHelper: (state, action: PayloadAction<{ key: keyof FloorHelpers; on: boolean }>) => {
      state.helpers[action.payload.key] = action.payload.on
    },
  },
})

export const {
  showFloorView,
  hideFloorView,
  setFloorRoom,
  selectFloorItems,
  openFloorObject,
  closeFloorObject,
  setFloorHelper,
} = floorSlice.actions

export default floorSlice.reducer
