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
      state.scaleFactor = Math.min(state.scaleFactor + 0.02, 4)
    },
    decreaseScaleFactor: (state: TWallView) => {
      state.scaleFactor = Math.max(state.scaleFactor - 0.02, 0.64)
    },
    // Zoom toward / away from the mouse cursor position
    zoomAtPoint: (
      state: TWallView,
      action: PayloadAction<{
        direction: 'in' | 'out'
        // Mouse position relative to the container element, normalised 0-1
        cursorXRatio: number
        cursorYRatio: number
        // Container dimensions in px
        containerWidth: number
        containerHeight: number
      }>,
    ) => {
      const { direction, cursorXRatio, cursorYRatio, containerWidth, containerHeight } =
        action.payload
      const W = 3000 // wrapper size in px – matches the CSS
      const oldScale = state.scaleFactor
      const newScale =
        direction === 'in' ? Math.min(oldScale + 0.02, 4) : Math.max(oldScale - 0.02, 0.64)

      if (newScale === oldScale) return

      // ---- Geometry ----------------------------------------------------------
      // CSS: wrapper positioned at left:50%; top:50% (TL corner at container centre)
      //      transform: translate(panX%, panY%) scale(s)
      //      transform-origin: 50% 50% (default = W/2, H/2 = 1500, 1500)
      //
      // CSS transforms compose R-to-L, so scale is applied first, then translate.
      // With transform-origin ox = W/2:
      //
      //   transformedX = (px - ox)*s + tx + ox
      //
      // where tx = panX/100 * W,  ox = W/2 = 1500
      //
      // Screen position (from container TL) = containerW/2 + transformedX
      //   screenX = containerW/2 + (px - ox)*s + tx + ox
      //
      // To keep cursor at (cx, cy) pointing to the same wrapper point (px, py)
      // when scale changes from s_old to s_new, we solve:
      //
      //   tx_new = D - (D - tx_old) * (s_new / s_old)
      //   where D = cx - containerW/2 - ox
      // ------------------------------------------------------------------

      const cx = cursorXRatio * containerWidth
      const cy = cursorYRatio * containerHeight
      const ox = W / 2
      const txOld = (state.panPosition.x / 100) * W
      const tyOld = (state.panPosition.y / 100) * W

      const Dx = cx - containerWidth / 2 - ox
      const Dy = cy - containerHeight / 2 - ox

      const ratio = newScale / oldScale
      const txNew = Dx - (Dx - txOld) * ratio
      const tyNew = Dy - (Dy - tyOld) * ratio

      state.scaleFactor = newScale
      state.panPosition.x = (txNew / W) * 100
      state.panPosition.y = (tyNew / W) * 100
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
    setSizeLocked: (
      state: TWallView,
      action: PayloadAction<{ artworkId: string; value: boolean }>,
    ) => {
      state.sizeLockedById[action.payload.artworkId] = action.payload.value
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
    setSnapEnabled: (
      state: TWallView,
      action: PayloadAction<{ artworkId: string; value: boolean }>,
    ) => {
      state.snapEnabledById[action.payload.artworkId] = action.payload.value
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
  zoomAtPoint,
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
  setSnapEnabled,
} = wallViewSlice.actions

export default wallViewSlice.reducer
