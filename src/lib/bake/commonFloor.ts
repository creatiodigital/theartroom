/**
 * AR-161 (spec rule 3) — the one floor of every room of every baked space: "a real gallery won't
 * change the floor per exhibition". In a baked space the floor columns an exhibition stores are
 * ignored (the editor still shows them in its realtime preview), except the boards' size and
 * placement (`bakedFloorTiling`, AR-163).
 *
 * A pale whitewashed oak: every wood texture is orange in linear light, and its bounce painted
 * the rooms beige-brown. A matte finish (roughness 1, no metal) with its own normal map at ×1:
 * the floor's gloss is the room's reflection in the environment, not a second mirror pass.
 *
 * Plain module (no React, no three) — `spaceLooks` carries it, so the server fingerprint hashes it.
 */
export interface CommonFloor {
  /** A `ReflectiveFloor` material set. */
  material: string
  /** Texture repeats per 10 m (the stored `floorTextureScale`). */
  textureScale: number
  offsetX: number
  offsetY: number
  /** Degrees. */
  rotation: number
  /** −1 cool … 1 warm; 0 = the texture's own color. */
  temperature: number
  normalScale: number
  roughness: number
  metalness: number
}

export const COMMON_FLOOR: CommonFloor = {
  material: 'parquet-whitewash',
  textureScale: 2.07,
  offsetX: 0,
  offsetY: 0.04,
  rotation: 0,
  // Beige, like a real parquet (Eduardo 2026-10-21: "too greyish"; 0.5 was too subtle): the
  // warmest tint, the boards' red to blue ×1.32 over the whitewash photo — a light oak, short of
  // a real wood texture's orange. The bake takes it too (the floor's bounce is its color), so the
  // room's light warms with it a little.
  temperature: 1,
  normalScale: 1,
  roughness: 1,
  metalness: 0,
}

/** How the floor's boards lie: their size and placement. */
export type FloorTiling = Pick<CommonFloor, 'textureScale' | 'offsetX' | 'offsetY' | 'rotation'>

/** The floor columns an exhibition stores (`floorMaterial`, `floorTextureScale`, …). */
export interface StoredFloor {
  floorMaterial?: string | null
  floorTextureScale?: number | null
  floorTextureOffsetX?: number | null
  floorTextureOffsetY?: number | null
  floorRotation?: number | null
}

/**
 * AR-163 (Eduardo 2026-10-21): in a baked space the artist sets the boards' size and placement
 * again — never the floor itself. A tiling only means something for the texture it was set on: an
 * exhibition's stored tiling counts once it was set for the space's floor (its stored material is
 * that floor's — the editor stores both together); one set for an earlier floor shows the space's
 * own tiling. A tiling never changes the light (the bake takes the floor's average color), so it
 * never stales a bake.
 */
export const bakedFloorTiling = (floor: CommonFloor, stored: StoredFloor): FloorTiling => {
  if (stored.floorMaterial !== floor.material)
    return {
      textureScale: floor.textureScale,
      offsetX: floor.offsetX,
      offsetY: floor.offsetY,
      rotation: floor.rotation,
    }
  return {
    textureScale: stored.floorTextureScale ?? floor.textureScale,
    offsetX: stored.floorTextureOffsetX ?? floor.offsetX,
    offsetY: stored.floorTextureOffsetY ?? floor.offsetY,
    rotation: stored.floorRotation ?? floor.rotation,
  }
}
