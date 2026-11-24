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
}

const initialState: FloorState = {
  isFloorView: false,
  room: 0,
  selectedIds: [],
  openObjectSlug: null,
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
  },
})

export const {
  showFloorView,
  hideFloorView,
  setFloorRoom,
  selectFloorItems,
  openFloorObject,
  closeFloorObject,
} = floorSlice.actions

export default floorSlice.reducer
