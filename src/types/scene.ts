import type { TWall } from './wallView'

export type TFocusTarget = {
  artworkId: string
  position: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  width: number
  height: number
  /**
   * How far the work's face stands out from `position` toward the viewer (m): an unframed print on
   * its support (up to 10 cm). Artwork View frames the face, not the wall behind it. 0 if absent.
   */
  front?: number
  /**
   * The target is a group's works framed together (an autofocus group), not one work: on a larger
   * screen Artwork View comes nearer a group than a single work (`artworkViewNearest`).
   */
  group?: boolean
}

/** Lamps of one kind, grouped by the room Empty they are parented under in the
 *  GLB. A space with no `room*` parents yields a single group with `room: null`,
 *  which is how Paris and Madrid behave — they keep a flat, ungrouped list. */
export type TLampGroup = { room: string | null; indices: number[] }

export type TExitPromptSource = 'walk' | 'button'

export type TScene = {
  /**
   * The visitor stands in Artwork View, the owner's "Wall View" (MainCamera): a tap on a work frames
   * it, and every move then travels over its wall. Shows the Exit Wall View button.
   */
  inArtworkView: boolean
  /**
   * Bumped by the Exit Wall View button: MainCamera steps back from the wall. A counter rather than
   * a boolean so every press registers.
   */
  artworkViewExitNonce: number
  isArtworkPanelOpen: boolean
  isPlaceholdersShown: boolean
  currentArtworkId: string | null
  walls: TWall[]
  focusTarget: TFocusTarget | null
  /** Dynamic camera start position [x, z] from GLB initialPoint node */
  initialCameraPosition: [number, number] | null
  /** Dynamic camera look direction [x, z] from GLB initialPoint normal */
  initialCameraDirection: [number, number] | null
  /**
   * "Leave the exhibition?" confirmation. Lives in scene state because it is
   * raised from two unrelated places — the corner close button in the
   * exhibition chrome, and walking past the exit threshold inside the 3D
   * scene — and both must drive the same single dialog.
   */
  isExitPromptOpen: boolean
  /**
   * What raised the open prompt (AR-174): walking up to the exit, or the corner close button.
   * Only a walk-up sends a visitor who stays back to the entrance; after the button they stay
   * exactly where they were. Null while it's closed.
   */
  exitPromptSource: TExitPromptSource | null
  /**
   * Bumped when a visitor who WALKED to the exit declines to leave. Staying returns them to the
   * entrance rather than leaving them on the exit threshold, which also means the threshold can
   * never re-fire under them, so no arm/disarm bookkeeping is needed. A counter rather than a
   * boolean so repeated declines each register.
   */
  /** Track lamps present in the loaded space, in GLB order. Derived from the
   *  model at load, never persisted — the GLB is the source of truth for how
   *  many lamps a space has. */
  trackLampGroups: TLampGroup[]
  exitRespawnNonce: number
  /**
   * AR-182: the language the room's texts are shown in: the exhibition's second language (its
   * code), or null for English. Set on entry and by the room menu's switch; every text artwork
   * reads it, so switching changes them all at once, in place.
   */
  roomLanguage: string | null
}
