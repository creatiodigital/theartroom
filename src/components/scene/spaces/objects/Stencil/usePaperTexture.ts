import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace } from 'three'
import { useMemo } from 'react'

/**
 * Paper material presets.
 * Each preset defines PBR texture paths and material parameters.
 * The textures live under /assets/materials/paper/ (user-provided PBR set).
 */

const PAPER_TEXTURE_BASE = '/assets/materials/paper'

export interface PaperMaterialConfig {
  roughness: number
  normalScale: number
  aoIntensity: number
  /** How many times the texture repeats across the card surface */
  textureRepeat: number
}

/**
 * Hook to load PBR paper textures and return them with material config.
 * Uses drei's useTexture (Suspense-based) following the PlasterWall pattern.
 */
export function usePaperTexture(textureRepeat = 2) {
  const textures = useTexture({
    map: `${PAPER_TEXTURE_BASE}/diffuse.jpg`,
    normalMap: `${PAPER_TEXTURE_BASE}/normal.jpg`,
    roughnessMap: `${PAPER_TEXTURE_BASE}/roughness.jpg`,
    aoMap: `${PAPER_TEXTURE_BASE}/ao.jpg`,
  })

  // Configure tiling — memo to avoid re-applying every render
  useMemo(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(textureRepeat, textureRepeat)
    })
    textures.map.colorSpace = SRGBColorSpace
  }, [textures, textureRepeat])

  return textures
}

// Preload paper textures at module scope to avoid Suspense flicker
useTexture.preload([
  `${PAPER_TEXTURE_BASE}/diffuse.jpg`,
  `${PAPER_TEXTURE_BASE}/normal.jpg`,
  `${PAPER_TEXTURE_BASE}/roughness.jpg`,
  `${PAPER_TEXTURE_BASE}/ao.jpg`,
])
