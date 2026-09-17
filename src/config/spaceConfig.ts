/**
 * Space Configuration Registry
 *
 * Defines which lighting features are available for each space type.
 * Add entries here when creating new spaces.
 */

export type SpaceFeatures = {
  hasSkylight: boolean
  hasLamps: boolean
  hasTrackLamps: boolean
  hasRecessedLamps: boolean
  hasWindows: boolean
  hasReflectiveFloor: boolean
  /** Per-lamp offset axis: 'x' or 'z'. Lamps not listed default to 'x'. */
  trackLampOffsetAxes?: Record<number, 'x' | 'z'>
  /**
   * Lamp node indices, keyed by node prefix, that are never switched off — and
   * that are excluded from their room's centre.
   *
   * For lamps lighting the corridor BETWEEN two rooms. They belong to one room
   * in Blender, so room culling took them with it: walking from room1 you pass
   * directly under a fixture that is still off, because room0 has not become
   * active yet. Listing them here keeps the connecting corridor lit from both
   * ends, at the cost of those spotlights always being live.
   *
   * Indices are NODE indices from the GLB (`roundLampBody15`), not positions in
   * a loop — the same numbering `getNodeIndices` returns, which tolerates gaps.
   */
  alwaysLitLamps?: Record<string, readonly number[]>
}

export const spaceConfig: Record<string, SpaceFeatures> = {
  paris: {
    hasSkylight: false,
    hasLamps: false,
    hasTrackLamps: true,
    hasRecessedLamps: true,
    hasWindows: true,
    hasReflectiveFloor: true,
    // Lamps 0-7 face walls along Z, lamps 8-13 face walls along X
    trackLampOffsetAxes: {
      0: 'x',
      1: 'x',
      2: 'x',
      3: 'x',
      4: 'x',
      5: 'x',
      6: 'x',
      7: 'x',
      8: 'z',
      9: 'z',
      10: 'z',
      11: 'z',
      12: 'z',
      13: 'z',
    },
  },
  // Vienna runs Paris's rig at a larger scale: track + recessed lamps, windows,
  // reflective floor. Track-lamp offset axes are omitted deliberately — with 28
  // lamps across two rooms the per-lamp map would be pure maintenance burden,
  // and lamps not listed default to 'x'.
  vienna: {
    hasSkylight: false,
    // True because the model HAS 34 round lamps (roundLampBody0-33, split 17/17 across the
    // two rooms). It was false, which hid their controls in LightingPanel while the mode
    // dropdown still offered 'plafond' — and that mode mounts <RoundLamp>. The result was 34
    // fixtures on screen that the artist could not steer, except by accident via the
    // recessedLamp* values RoundLamp happens to read.
    hasLamps: true,
    hasTrackLamps: true,
    hasRecessedLamps: true,
    hasWindows: true,
    hasReflectiveFloor: true,
    // The two fixtures lighting the corridor that CONNECTS the rooms, at
    // x ≈ -4.85, z ≈ 7.8 and z ≈ 11.4/12.6. Blender parents them to room0, so
    // culling switched them off for anyone walking in from room1 — and the
    // visitor spawns in room1, so that was the common direction.
    //
    // Each physical fixture appears twice because the ceiling mode decides which
    // component renders it: 'plafond' mounts RoundLamp, 'track-plafond' mounts
    // RecessedLamp. Both numberings must be listed or the exemption silently
    // applies to only one mode.
    //
    // Deliberately NOT the entrance-corridor pair (roundLampBody32/33,
    // recessedLampBody14/15 at z ≈ 27.2). That corridor is a dead end off room1
    // and is only ever seen while room1 is active, so it can ride with the room.
    alwaysLitLamps: {
      roundLampBody: [15, 16],
      recessedLampBody: [6, 7],
    },
  },
  madrid: {
    hasSkylight: false,
    hasLamps: false,
    hasTrackLamps: false,
    hasRecessedLamps: true,
    hasWindows: true,
    hasReflectiveFloor: true,
  },
}

/**
 * Get features for a space, with sensible defaults for unknown spaces.
 */
export const getSpaceFeatures = (spaceId: string): SpaceFeatures => {
  return (
    spaceConfig[spaceId] ?? {
      hasSkylight: false,
      hasLamps: false,
      hasTrackLamps: true,
      hasRecessedLamps: true,
      hasWindows: true,
      hasReflectiveFloor: true,
    }
  )
}
