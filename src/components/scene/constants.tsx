import dynamic from 'next/dynamic'

import { spaceGltfPaths } from '@/lib/bake/spaceModelVersion'
import { spaceLooks } from '@/lib/bake/spaceLooks'

import type { SpaceConfig } from './spaces/types'

// =============================================================================
// Space Registry
// =============================================================================

/**
 * Available space keys. Add new spaces here.
 */
export type SpaceKey = 'paris' | 'madrid' | 'vienna'

/**
 * Configuration for each space including refs, metadata, and assets.
 * When adding a new space:
 * 1. Add the key to SpaceKey type
 * 2. Add config here
 * 3. Add component to spaceComponents
 */
/**
 * `gltfPath` is the asset's BARE path, not a URL.
 *
 * `spaceGltfUrl` turns it into one: R2 normally, the app's own origin when R2
 * answers 404 or cannot be reached. Both need the same bare path — R2 to build
 * the remote URL, Vercel to serve `public/assets` — so this is the one form
 * that can express both.
 */
export const spaceConfigs: Record<SpaceKey, SpaceConfig> = {
  paris: {
    displayName: 'Paris',
    // AR-161: paris22 = corridor-end opening + windowLight1, as a meshopt `_noq` (no quantize).
    // On R2 (uploaded BEFORE any push — AR-127 outage); public/ copy is the origin fallback only.
    gltfPath: spaceGltfPaths.paris!,
    camera: spaceLooks.paris!.camera,
    look: spaceLooks.paris!.look,
  },
  vienna: {
    displayName: 'Vienna',
    gltfPath: spaceGltfPaths.vienna!,
    camera: spaceLooks.vienna!.camera,
    look: spaceLooks.vienna!.look,
  },
  madrid: {
    displayName: 'Madrid',
    gltfPath: spaceGltfPaths.madrid!,
    camera: spaceLooks.madrid!.camera,
    look: spaceLooks.madrid!.look,
  },
}

/**
 * Lazy-loaded space components for better performance.
 * Each space is only loaded when needed.
 */
export const spaceComponents = {
  paris: dynamic(() => import('./spaces/ParisSpace'), { ssr: false }),
  madrid: dynamic(() => import('./spaces/MadridSpace'), { ssr: false }),
  vienna: dynamic(() => import('./spaces/ViennaSpace'), { ssr: false }),
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
