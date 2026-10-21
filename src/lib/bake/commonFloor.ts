/**
 * AR-161 (spec rule 3) — the one floor of every room of every baked space: "a real gallery won't
 * change the floor per exhibition". In a baked space the floor columns an exhibition stores are
 * ignored (the editor still shows them in its realtime preview).
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
  temperature: 0,
  normalScale: 1,
  roughness: 1,
  metalness: 0,
}
