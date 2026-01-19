import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { wallViewFactory } from '@/factories/wallViewFactory'
import type {
  TWallView,
  TCoordinates,
  TWallDimensions,
  TArtworkGroup,
  TAlignmentPair,
} from '@/types/wallView'

const wallViewSlice = createSlice({
  name: 'wallView',
  initialState: wallViewFactory(),
  reducers: {
    showWallView: (state: TWallView, action: PayloadAction<string>) => {
      state.isWallView = true
      state.currentWallId = action.payload
    },
    hideWallView: (state: TWallView) => {
      state.isWallView = false
      state.currentWallId = null
    },
    resetWallView: () => {
      // Return fresh initial state to prevent stale data between exhibitions
      return wallViewFactory()
    },
    showHuman: (state: TWallView) => {
      state.isHumanVisible = true
    },
    hideHuman: (state: TWallView) => {
      state.isHumanVisible = false
    },
    chooseCurrentArtworkId: (state: TWallView, action: PayloadAction<string | null>) => {
      state.currentArtworkId = action.payload
    },
    increaseScaleFactor: (state: TWallView) => {
      state.scaleFactor = Math.min(state.scaleFactor + 0.02, 2)
    },
    decreaseScaleFactor: (state: TWallView) => {
      state.scaleFactor = Math.max(state.scaleFactor - 0.02, 0.64)
    },
    setPanPosition: (
      state: TWallView,
      action: PayloadAction<{ deltaX: number; deltaY: number }>,
    ) => {
      const { deltaX, deltaY } = action.payload
      state.panPosition = {
        x: state.panPosition.x + deltaX * 100,
        y: state.panPosition.y + deltaY * 100,
      }
    },
    resetPan: (state: TWallView) => {
      state.panPosition = { x: -50, y: -50 }
      state.scaleFactor = 1
    },
    setWallDimensions: (state: TWallView, action: PayloadAction<TWallDimensions>) => {
      const { width, height } = action.payload
      state.wallWidth = width
      state.wallHeight = height
    },
    setWallCoordinates: (
      state: TWallView,
      action: PayloadAction<{ coordinates: TCoordinates; normal: TCoordinates }>,
    ) => {
      const { coordinates, normal } = action.payload
      state.currentWallCoordinates = coordinates
      state.currentWallNormal = normal
    },
    setAlignedPairs: (state: TWallView, action: PayloadAction<TAlignmentPair[]>) => {
      state.alignedPairs = action.payload
    },
    clearAlignedPairs: (state: TWallView) => {
      state.alignedPairs = []
    },
    startDragging: (state: TWallView) => {
      state.isDragging = true
    },
    stopDragging: (state: TWallView) => {
      state.isDragging = false
    },
    startDraggingGroup: (state: TWallView) => {
      state.isDraggingGroup = true
    },
    stopDraggingGroup: (state: TWallView) => {
      state.isDraggingGroup = false
    },
    startResizing: (state: TWallView) => {
      state.isResizing = true
    },
    stopResizing: (state: TWallView) => {
      state.isResizing = false
    },
    setShiftKeyDown: (state: TWallView, action: PayloadAction<boolean>) => {
      state.isShiftKeyDown = action.payload
    },
    setSizeLocked: (state: TWallView, action: PayloadAction<boolean>) => {
      state.sizeLocked = action.payload
    },
    addArtworkToGroup: (state: TWallView, action: PayloadAction<string>) => {
      if (!state.artworkGroupIds.includes(action.payload)) {
        state.artworkGroupIds.push(action.payload)
      }
    },
    removeArtworkFromGroup: (state: TWallView, action: PayloadAction<string>) => {
      state.artworkGroupIds = state.artworkGroupIds.filter((id) => id !== action.payload)
    },
    createArtworkGroup: (state: TWallView, action: PayloadAction<TArtworkGroup>) => {
      state.artworkGroup = action.payload
    },
    editArtworkGroup: (
      state: TWallView,
      action: PayloadAction<{ groupX?: number; groupY?: number }>,
    ) => {
      state.artworkGroup.groupX = action.payload.groupX ?? 0
      state.artworkGroup.groupY = action.payload.groupY ?? 0
    },
    removeGroup: (state: TWallView) => {
      state.artworkGroupIds = []
    },
    setGroupHovered: (state: TWallView) => {
      state.isGroupHovered = true
    },
    setGroupNotHovered: (state: TWallView) => {
      state.isGroupHovered = false
    },
    openArtworkEditModal: (state: TWallView, action: PayloadAction<string>) => {
      state.editingArtworkId = action.payload
    },
    closeArtworkEditModal: (state: TWallView) => {
      state.editingArtworkId = null
    },
  },
})

export const {
  showWallView,
  hideWallView,
  resetWallView,
  showHuman,
  hideHuman,
  chooseCurrentArtworkId,
  increaseScaleFactor,
  decreaseScaleFactor,
  setPanPosition,
  resetPan,
  setWallDimensions,
  setWallCoordinates,
  setAlignedPairs,
  clearAlignedPairs,
  startDragging,
  stopDragging,
  startDraggingGroup,
  stopDraggingGroup,
  startResizing,
  stopResizing,
  createArtworkGroup,
  editArtworkGroup,
  addArtworkToGroup,
  removeArtworkFromGroup,
  setShiftKeyDown,
  setSizeLocked,
  removeGroup,
  setGroupHovered,
  setGroupNotHovered,
  openArtworkEditModal,
  closeArtworkEditModal,
} = wallViewSlice.actions

export default wallViewSlice.reducer
