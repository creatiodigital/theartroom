import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, CanvasTexture, Texture } from 'three'
import { useEffect, useMemo } from 'react'

import { assetUrl } from '@/lib/assetUrl'

/**
 * Paper material presets.
 * Each preset defines PBR texture paths and material parameters.
 * The textures live under /assets/materials/paper/ (user-provided PBR set).
 */

const PAPER_TEXTURE_BASE = assetUrl('/assets/materials/paper')

/**
 * Lighten a texture by blending it towards white.
 * @param opacity 0 = fully white, 1 = original. Default 0.35 keeps subtle paper grain.
 */
function lightenTexture(texture: Texture, opacity = 0.35): Texture {
  const image = (texture as { image?: HTMLImageElement }).image
  if (!image) return texture

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!

  // Draw white base
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw original texture on top with reduced opacity
  ctx.globalAlpha = opacity
  ctx.drawImage(image, 0, 0)

  const lightened = new CanvasTexture(canvas)
  lightened.colorSpace = SRGBColorSpace
  lightened.wrapS = texture.wrapS
  lightened.wrapT = texture.wrapT
  lightened.repeat.copy(texture.repeat)
  return lightened
}

/** How far the diffuse is blended towards white: keeps the grain, loses the beige. */
const LIGHTEN_OPACITY = 0.35

/*
 * One lightened diffuse per source texture and repeat, shared by every card
 * that uses it. The sources are already shared (drei caches them by URL); the
 * lightened copy used to be made per card — a 2048² canvas plus its GPU upload
 * (~38 MB) for each text work with a paper background, never freed. Counted
 * per user and disposed when the last card unmounts. Same pixels as before.
 */
const lightenedBySource = new WeakMap<Texture, Map<number, { texture: Texture; users: number }>>()

function acquireLightened(source: Texture, repeat: number): Texture {
  let byRepeat = lightenedBySource.get(source)
  if (!byRepeat) {
    byRepeat = new Map()
    lightenedBySource.set(source, byRepeat)
  }
  let entry = byRepeat.get(repeat)
  if (!entry) {
    const texture = lightenTexture(source, LIGHTEN_OPACITY)
    // No image to lighten: the source itself, which is drei's to keep.
    if (texture === source) return source
    entry = { texture, users: 0 }
    byRepeat.set(repeat, entry)
  }
  entry.users++
  return entry.texture
}

function releaseLightened(source: Texture, repeat: number): void {
  const byRepeat = lightenedBySource.get(source)
  const entry = byRepeat?.get(repeat)
  if (!entry) return
  entry.users--
  if (entry.users <= 0) {
    entry.texture.dispose()
    byRepeat!.delete(repeat)
  }
}

/**
 * Hook to load PBR paper textures and return them with material config.
 * Uses drei's useTexture (Suspense-based).
 */
export function usePaperTexture(textureRepeat = 2) {
  const textures = useTexture({
    map: `${PAPER_TEXTURE_BASE}/diffuse.jpg?v=2`,
    normalMap: `${PAPER_TEXTURE_BASE}/normal.jpg?v=2`,
    roughnessMap: `${PAPER_TEXTURE_BASE}/roughness.jpg?v=2`,
    aoMap: `${PAPER_TEXTURE_BASE}/ao.jpg?v=2`,
  })

  // Configure tiling and lighten diffuse — memo to avoid re-applying every render
  const processedMap = useMemo(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(textureRepeat, textureRepeat)
    })
    textures.map.colorSpace = SRGBColorSpace

    // Lighten diffuse to reduce beige tint while keeping paper grain
    return acquireLightened(textures.map, textureRepeat)
  }, [textures, textureRepeat])

  // Taken in render above, given back when this card stops using it.
  useEffect(() => () => releaseLightened(textures.map, textureRepeat), [textures, textureRepeat])

  return { ...textures, map: processedMap }
}

// Preload paper textures at module scope to avoid Suspense flicker
useTexture.preload([
  `${PAPER_TEXTURE_BASE}/diffuse.jpg?v=2`,
  `${PAPER_TEXTURE_BASE}/normal.jpg?v=2`,
  `${PAPER_TEXTURE_BASE}/roughness.jpg?v=2`,
  `${PAPER_TEXTURE_BASE}/ao.jpg?v=2`,
])
