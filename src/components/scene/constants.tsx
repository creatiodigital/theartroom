import dynamic from 'next/dynamic'

import type { SpaceConfig } from './spaces/types'

// =============================================================================
// Space Registry
// =============================================================================

/**
 * Available space keys. Add new spaces here.
 */
export type SpaceKey = 'paris'

/**
 * Configuration for each space including refs, metadata, and assets.
 * When adding a new space:
 * 1. Add the key to SpaceKey type
 * 2. Add config here
 * 3. Add component to spaceComponents
 */
export const spaceConfigs: Record<SpaceKey, SpaceConfig> = {
  paris: {
    displayName: 'Paris',
    gltfPath: '/assets/spaces/paris/paris10.glb?v=2',
    thumbnailUrl: '/assets/thumbnails/paris.jpg',
    refs: {
      walls: 4, // wall0 + doorFrame0 + doorMain0 + radiator0
      windows: 2,
      glass: 1,
    },
    placeholders: 4,
  },
}

/**
 * Lazy-loaded space components for better performance.
 * Each space is only loaded when needed.
 */
export const spaceComponents = {
  paris: dynamic(() => import('./spaces/ParisSpace'), { ssr: false }),
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get space config by key, with fallback to 'paris'.
 */
export const getSpaceConfig = (spaceId: string): SpaceConfig => {
  const key = spaceId as SpaceKey
  return spaceConfigs[key] || spaceConfigs['paris']
}

/**
 * Get all available space options for UI.
 */
export const getSpaceOptions = () =>
  Object.entries(spaceConfigs).map(([key, config]) => ({
    value: key as SpaceKey,
    label: config.displayName,
    thumbnailUrl: config.thumbnailUrl,
  }))
