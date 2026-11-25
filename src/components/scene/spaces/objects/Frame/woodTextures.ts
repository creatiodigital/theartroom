import { SRGBColorSpace, TextureLoader, type Texture } from 'three'

import { assetUrl } from '@/lib/assetUrl'
import type { WoodTexture } from '@/lib/floor/pedestals'

/**
 * AR-169 (Eduardo 2026-10-29: "a realistic wooden texture size, no matter the thickness or size
 * of the frame"): one tile of the wood maps (diffuse, normal, roughness) covers this much board,
 * in metres — the print studio's frames (`StudioFrame`, 0.26–0.36 m). A frame's UVs are in tiles
 * of real board, so a bigger frame shows more wood, never bigger grain. `Display` scales it by the
 * artist's texture scale (1× at its default) and the texture's own width-to-height ratio.
 */
export const WOOD_TILE_M = 0.31

/** Wood textures' width over height (`wooden-frame-light` is 2048 × 1024; the others square). */
export const WOOD_ASPECT: Record<string, number> = { 'wood-light': 2 }

// Shared sources for frame PBR maps.
//
// Every artwork in a show uses the same handful of frame texture files, but each
// needs its OWN repeat/offset/rotation (per-artwork frame scale, plus a seeded
// grain offset so adjacent wood frames don't look stamped). Those live on the
// Texture, not the material — so each Display used to call `new TextureLoader()`
// and get a private copy. On a 92-artwork exhibition that meant 40 identical
// uploads of each 2048² map: measured at 1.7 GB of pure duplication, 70% of the
// scene's entire texture budget.
//
// three allocates GPU memory per `texture.source`, and its texture cache key
// (getTextureCacheKey) covers only sampler/format state — wrap, filters,
// anisotropy, colorSpace — NOT repeat/offset/rotation. So a clone that shares one
// Source costs ONE upload however many artworks use it, while keeping its own UV
// transform. three refcounts those sharers itself (`usedTimes`), freeing the GPU
// texture only when the last clone is disposed, so the existing per-Display
// `dispose()` cleanup stays correct.
//
// Sampler state is set on the BASE before cloning, so every clone hashes to the
// same cache key and they genuinely share. Set it per-clone instead and they
// would silently split back into separate uploads.
const frameTextureBases = new Map<string, Texture>()

// Clones taken while their shared Source was still empty — see cloneFrameTexture.
const clonesAwaitingImage = new Map<string, Texture[]>()

const releaseClonesAwaitingImage = (url: string) => {
  const waiting = clonesAwaitingImage.get(url)
  clonesAwaitingImage.delete(url)
  waiting?.forEach((clone) => {
    clone.needsUpdate = true
  })
}

const getFrameTextureBase = (url: string, srgb: boolean): Texture => {
  const cached = frameTextureBases.get(url)
  if (cached) return cached

  const texture = new TextureLoader().load(
    url,
    () => releaseClonesAwaitingImage(url),
    undefined,
    // Nothing will ever arrive, so drop the held clones rather than retaining
    // them for the life of the page. They stay at version 0 and simply never
    // upload, which is what they did before this anyway.
    () => clonesAwaitingImage.delete(url),
  )
  texture.wrapS = texture.wrapT = 1000 // RepeatWrapping
  if (srgb) texture.colorSpace = SRGBColorSpace
  frameTextureBases.set(url, texture)
  return texture
}

/**
 * A private Texture over a shared Source: own UV transform, one GPU upload.
 *
 * `Texture.copy()` ends with `this.needsUpdate = true`, so a clone is born with
 * `version = 1` — "upload me". `TextureLoader.load()` returns its texture
 * synchronously with `source.data` still null, so a clone taken in that window
 * is marked for upload with nothing to upload, and three's `setTexture2D`
 * warns "Texture marked for update but no image data found" for that clone on
 * EVERY frame until the fetch lands (forever, if it fails).
 *
 * The base itself escapes this only because it is never cloned from: it sits at
 * `version = 0` until the loader sets both image and version together.
 *
 * So hold the clone at version 0 too, and mark it the moment the image is
 * really there. `image` reads through to the shared Source, so by then the
 * clone already has the pixels — this only tells three when to look.
 */
export const cloneFrameTexture = (url: string, srgb: boolean): Texture => {
  const base = getFrameTextureBase(url, srgb)
  const clone = base.clone()

  if (base.image === null) {
    clone.version = 0
    const waiting = clonesAwaitingImage.get(url) ?? []
    waiting.push(clone)
    clonesAwaitingImage.set(url, waiting)
  }

  return clone
}

/** A stable 0–1 offset per id, so two pieces of the same wood never show the same grain. */
export function grainOffset(id: string): [number, number] {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return [(hash & 0xffff) / 0xffff, ((hash >>> 16) & 0xffff) / 0xffff]
}

/**
 * One of the frames' woods for a piece of floor furniture (floor composing, 2026-11-25): its own
 * clones of the shared maps, at the board's real size (UVs in tiles of `WOOD_TILE_M`, see
 * `boardUVs`), its grain offset by `seed`. The caller disposes them.
 */
export function woodMapSet(wood: WoodTexture, seed: string) {
  const base = assetUrl(`/assets/materials/wooden-frame-${wood}`)
  const maps = {
    map: cloneFrameTexture(`${base}/diffuse.jpg?v=3`, true),
    normalMap: cloneFrameTexture(`${base}/normal.jpg?v=3`, false),
    roughnessMap: cloneFrameTexture(`${base}/roughness.jpg?v=3`, false),
  }
  const aspect = WOOD_ASPECT[`wood-${wood}`] ?? 1
  const [ox, oy] = grainOffset(seed)
  for (const t of Object.values(maps)) {
    t.repeat.set(1, aspect)
    t.offset.set(ox, oy)
  }
  return maps
}
