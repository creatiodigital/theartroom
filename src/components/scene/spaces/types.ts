import type { SpaceCamera, SpaceLook } from '@/lib/bake/spaceLooks'

// =============================================================================
// Space Configuration Types
// =============================================================================

/**
 * Configuration for ref counts per space.
 * Defines how many of each ref type the space needs.
 */
export type SpaceRefsCount = {
  walls?: number
  windows?: number
  glass?: number
  // Extensible for future ref types
  [key: string]: number | undefined
}

/**
 * Complete configuration for a space.
 * Used for space registry and UI.
 */
export type SpaceConfig = {
  /** Display name for UI */
  displayName: string
  /** Path to GLTF model */
  gltfPath: string
  /** Ref counts, when a space needs to override what is counted from the model */
  refs?: SpaceRefsCount
  /** Default camera start position [x, z] — camera will be placed at (x, cameraElevation, z) */
  defaultCameraPosition?: [number, number]
  /**
   * AR-161: the space's fixed camera — exposure and white-balance gains [r, g, b], the same for
   * every exhibition hung in it (no auto mode). Calibrated once from the space's approved
   * reference bake; changes only with the space (a new model or a new approved look).
   */
  camera?: SpaceCamera
  /**
   * AR-161: the space's approved look — lamp ratings, daylight, sun, paint, the floor and the
   * values it owns instead of the exhibition (`SpaceLook`). From `spaceLooks`, with `camera`.
   */
  look?: SpaceLook
}
