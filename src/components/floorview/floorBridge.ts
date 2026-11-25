import type { FloorEditor } from './useFloorEditor'

/**
 * The Floor view's editor, reachable from inside the 3D canvas (floor composing: dragging in the
 * live 3D). The editor lives in the Floor view, which is not an ancestor of the canvas, so no
 * React context reaches it; the view sets this while it is open and clears it when it closes.
 */
export const floorBridge: {
  editor: FloorEditor | null
  /** A picked group member brings its ⌘G group (as on the plan). */
  expand: (ids: string[]) => string[]
} = { editor: null, expand: (ids) => ids }
