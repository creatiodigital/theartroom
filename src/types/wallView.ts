export type TWall = {
  id: string
  name: string
}

export type TCoordinates = {
  x: number
  y: number
  z: number
}

export type TAlignmentPair = {
  from: string
  to: string
  direction:
    | 'horizontal'
    | 'vertical'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'center-horizontal'
    | 'center-vertical'
}

export type TPanPosition = {
  x: number
  y: number
}

export type TWallDimensions = {
  width: number | null
  height: number | null
}

export type TArtworkGroup = {
  groupX: number
  groupY: number
  groupWidth: number
  groupHeight: number
}

export type TGuide = {
  id: string
  wallId: string
  orientation: 'horizontal' | 'vertical'
  position: number // metres from wall origin
}

export type TWallView = {
  isWallView: boolean
  currentArtworkId: string | null
  currentWallId: string | null
  editingArtworkId: string | null // Artwork ID for the edit modal overlay
  currentWallCoordinates: TCoordinates
  currentWallNormal: TCoordinates
  scaleFactor: number
  panPosition: TPanPosition
  isHumanVisible: boolean
  isRulersVisible: boolean
  wallHeight: number | null
  wallWidth: number | null
  isDragging: boolean
  isDraggingGroup: boolean
  isResizing: boolean
  isShiftKeyDown: boolean
  sizeLockedById: Record<string, boolean> // Lock proportions per artwork
  artworkGroupIds: string[]
  artworkGroup: TArtworkGroup
  isGroupHovered: boolean
  alignedPairs: TAlignmentPair[]
  isGridVisible: boolean
  isSnapEnabled: boolean
  guides: TGuide[]
  selectedGuideId: string | null
}

export type TDirection =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export type ResizeHandler<E extends Element = HTMLDivElement> = (
  event: React.MouseEvent<E>,
  artworkId: string,
  direction: TDirection,
) => void
