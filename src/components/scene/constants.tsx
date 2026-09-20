import dynamic from 'next/dynamic'

import type { SpaceConfig } from './spaces/types'
import { assetUrl } from '@/lib/assetUrl'

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
export const spaceConfigs: Record<SpaceKey, SpaceConfig> = {
  paris: {
    displayName: 'Paris',
    gltfPath: assetUrl('/assets/spaces/paris/paris21_noq.glb'),
  },
  vienna: {
    displayName: 'Vienna',
    // TEMPORARY (2026-09-20) — served from the app's own origin, NOT R2.
    //
    // `assetUrl` would point this at R2, which is where every other 3D asset
    // lives and where this belongs. The file could not be uploaded: the R2 S3
    // API (`<account>.r2.cloudflarestorage.com`) is unreachable from here, its
    // Cloudflare IP range being TCP-blocked by the Spanish ISP. READS are
    // unaffected — the CDN serves vienna12 fine — so this is a write-side
    // outage only, and intermittent.
    //
    // Staging 404s on this exact URL without the file, taking the whole Vienna
    // scene down, so the model ships in the repo instead (see the matching
    // negation in .gitignore).
    //
    // 🔴 REVERT once the upload succeeds: restore `assetUrl(...)` here, drop
    // the .gitignore negation, and delete the 9.3MB file from the repo.
    gltfPath: '/assets/spaces/vienna/vienna14.glb?v=1',
  },
  madrid: {
    displayName: 'Madrid',
    gltfPath: assetUrl('/assets/spaces/madrid/madrid12_noq.glb'),
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
