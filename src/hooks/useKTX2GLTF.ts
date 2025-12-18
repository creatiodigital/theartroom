'use client'

/**
 * useKTX2GLTF - A drop-in replacement for useGLTF with KTX2 texture support.
 *
 * This hook automatically configures the GLTF loader to use KTX2 for
 * compressed textures. It uses a global KTX2Loader that's initialized
 * once at app startup.
 *
 * Usage is identical to useGLTF from @react-three/drei.
 */

import { useGLTF } from '@react-three/drei'
import { useEffect } from 'react'

import { initKTX2Loader, configureGLTFLoader } from '@/lib/ktx2'

// Initialize KTX2 loader on module load (client-side only)
if (typeof window !== 'undefined') {
  initKTX2Loader()
}

/**
 * Load a GLTF/GLB model with KTX2 texture support.
 * Drop-in replacement for useGLTF from @react-three/drei.
 *
 * @param path - Path to the GLTF/GLB file
 * @returns GLTF object with nodes and materials
 *
 * @example
 * ```tsx
 * const { nodes, materials } = useKTX2GLTF<GLTFResult>('/assets/spaces/classic.glb')
 * ```
 */
export function useKTX2GLTF<T = ReturnType<typeof useGLTF>>(path: string): T {
  // Ensure KTX2 is initialized (in case module init didn't run)
  useEffect(() => {
    initKTX2Loader()
  }, [])

  // Load with KTX2 loader configured
  const gltf = useGLTF(path, undefined, undefined, (loader) => {
    configureGLTFLoader(loader)
  })

  return gltf as T
}

/**
 * Preload a GLTF/GLB with KTX2 support.
 * Note: This works but the KTX2 loader will be configured lazily
 * when the actual component loads.
 */
useKTX2GLTF.preload = (path: string) => {
  useGLTF.preload(path)
}

/**
 * Clear the GLTF cache for all space types.
 * Call this when switching exhibitions to ensure fresh geometry.
 */
export const clearAllSpaces = () => {
  useGLTF.clear('/assets/spaces/classic.glb')
  useGLTF.clear('/assets/spaces/modern.glb')
  // Add future space types here as they are added
}
