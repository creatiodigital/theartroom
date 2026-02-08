import dynamic from 'next/dynamic'

import type { SpaceConfig } from './spaces/types'

// =============================================================================
// Space Registry
// =============================================================================

/**
 * Available space keys. Add new spaces here.
 */
export type SpaceKey = 'classic' | 'modern' | 'paris'

/**
 * Configuration for each space including refs, metadata, and assets.
 * When adding a new space:
 * 1. Add the key to SpaceKey type
 * 2. Add config here
 * 3. Add component to spaceComponents
 */
export const spaceConfigs: Record<SpaceKey, SpaceConfig> = {
  classic: {
    displayName: 'Classic Gallery',
    gltfPath: '/assets/spaces/classic.glb',
    thumbnailUrl: '/assets/thumbnails/classic.jpg',
    refs: {
      walls: 1,
      windows: 2,
      glass: 2,
    },
    placeholders: 4,
  },
  modern: {
    displayName: 'Modern Gallery',
    gltfPath: '/assets/spaces/modern.glb',
    thumbnailUrl: '/assets/thumbnails/modern.jpg',
    refs: {
      walls: 1,
    },
    placeholders: 4,
  },

  paris: {
    displayName: 'Paris',
    gltfPath: '/assets/spaces/paris/paris9.glb',
    thumbnailUrl: '/assets/thumbnails/paris.jpg',
    refs: {
      walls: 1,
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
  classic: dynamic(() => import('./spaces/ClassicSpace'), { ssr: false }),
  modern: dynamic(() => import('./spaces/ModernSpace'), { ssr: false }),

  paris: dynamic(() => import('./spaces/ParisSpace'), { ssr: false }),
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get space config by key, with fallback to 'classic'.
 */
export const getSpaceConfig = (spaceId: string): SpaceConfig => {
  const key = spaceId as SpaceKey
  return spaceConfigs[key] || spaceConfigs['classic']
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
