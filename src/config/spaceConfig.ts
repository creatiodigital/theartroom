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
}

export const spaceConfig: Record<string, SpaceFeatures> = {
  classic: {
    hasSkylight: true,
    hasLamps: true,
    hasTrackLamps: false,
    hasRecessedLamps: false,
    hasWindows: true,
    hasReflectiveFloor: true,
  },
  modern: {
    hasSkylight: true,
    hasLamps: true,
    hasTrackLamps: false,
    hasRecessedLamps: false,
    hasWindows: false,
    hasReflectiveFloor: true,
  },
  paris: {
    hasSkylight: false,
    hasLamps: false,
    hasTrackLamps: true,
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
      hasSkylight: true,
      hasLamps: false,
      hasTrackLamps: false,
      hasRecessedLamps: false,
      hasWindows: false,
      hasReflectiveFloor: true,
    }
  )
}
