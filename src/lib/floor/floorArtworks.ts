/**
 * What the 3D room needs to draw an Object standing on the floor (docs/objects O6): its model and
 * its size, plus what its info window shows. Client-safe (the type only); the server reads them
 * in `floorArtworks.server.ts`.
 */
export type FloorArtwork = {
  id: string
  slug: string
  title: string
  /** The artist's name as the work credits it. */
  author: string
  imageUrl: string | null
  /** The ready .glb (docs/objects O4). */
  modelUrl: string
  /** The model's size in cm, read from the .glb on upload: H × W × D. */
  boundsCm: { h: number; w: number; d: number } | null
}

/** The floor's Objects' model sizes (cm, H × W × D) by artwork id: what placement needs. */
export type FloorSizes = Record<string, { h: number; w: number; d: number } | null | undefined>

export const floorSizes = (artworks: Record<string, FloorArtwork> | null | undefined): FloorSizes =>
  Object.fromEntries(Object.entries(artworks ?? {}).map(([id, a]) => [id, a.boundsCm]))
