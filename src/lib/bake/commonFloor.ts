/**
 * AR-161 (spec rule 3) — the one floor of every room of every baked space: "a real gallery won't
 * change the floor per exhibition". In a baked space the floor columns an exhibition stores are
 * ignored (the editor still shows them in its realtime preview), except the boards' size and
 * placement (`bakedFloorTiling`, AR-163) and the wood's tone (`bakedFloorTone`, AR-169).
 *
 * AR-169: planks of white oak (Design Connected's European White Oak 02: 50 photographed boards,
 * 3.65–5 m × 35–45 cm), laid into one seamless tile with their joints by
 * `.superpowers/ar169/tools/make_plank_floor.py` — the short strips of the whitewash parquet before
 * it read as laminate. Its gloss is its roughness map (mean 0.33, the whitewash's — the approved
 * sheen), at roughness ×1, no metal; its own normal
 * map at ×1 (brushed grain, V-groove joints), shaded by where the baked light comes from (the
 * floor's directional lightmap, like the plaster's); the grain's hollows are in its color.
 *
 * The artist chooses two things on it (Eduardo 2026-10-29), both real properties of a wood floor:
 * the boards' width (`boardWidth`, between a narrow strip and the photographed boards' own width;
 * the tile scales, the boards keep their proportions) and its tone (`tone`: the oak as
 * photographed, pale, … oiled honey). The tone is a stain: the light it lets through, per channel,
 * `stain ^ tone` (Beer–Lambert — a thicker coat absorbs more), so 0 is the wood's own color and
 * 1 the full `stain`. The tone changes the light the floor bounces, so it is in the fingerprint
 * (`bakedFloorTone`); the boards' width never is.
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
  /** Boards side by side across one tile of the set (its `layout.json`). */
  boardsAcross: number
  /** The board widths an artist may choose, cm (`textureScale` follows). */
  boardWidth: { min: number; max: number }
  /** The stain's amount: 0 the wood as photographed … 1 the full `stain`. */
  tone: number
  /** What the full stain lets through, per channel, linear (multiplies the photographed color). */
  stain: [number, number, number]
  normalScale: number
  roughness: number
  metalness: number
}

export const COMMON_FLOOR: CommonFloor = {
  material: 'white-oak',
  // Boards ~19 cm wide, 1.8–2.5 m long (one 8 m tile of 21 boards across, shown at 4 m): the
  // photographed 35–45 cm boards read huge in a room (Eduardo 2026-10-29: "the planks are huge").
  textureScale: 2.5,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  boardsAcross: 21,
  // A narrow plank floor … the boards as photographed (wider would blow up the grain too).
  boardWidth: { min: 12, max: 38 },
  tone: 0,
  // Natural oil on oak: honey (the 2026-10-29 renders' K).
  stain: [0.66, 0.5, 0.32],
  normalScale: 1,
  roughness: 1,
  metalness: 0,
}

/**
 * AR-169 (Eduardo 2026-10-31: "I just added a new material: parquet-medium… then we will add back
 * the option to select floor materials"): a medium-brown strip parquet — ambientCG's WoodFloor051
 * (CC0), its own roughness map (mean 0.35), normal and AO. One 2K tile holds ~23 strips across.
 */
export const PARQUET_MEDIUM: CommonFloor = {
  material: 'parquet-medium',
  // Strips ~8.7 cm wide (1000 / 5 / 23) — Eduardo 2026-10-31: "make the floor tile a little
  // bigger" than the 7 cm (6.2) first shown.
  textureScale: 5,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  boardsAcross: 23,
  boardWidth: { min: 5, max: 12 },
  tone: 0,
  stain: [0.66, 0.5, 0.32],
  normalScale: 1,
  roughness: 1,
  metalness: 0,
}

/**
 * AR-169 (Eduardo 2026-10-31: a lighter parquet — "parquet-whitewash is terrible"): light ash
 * planks — Poliigon's Wood Floor Ash 4186 (2K: base color, OpenGL normal, roughness mean 0.40,
 * AO). One tile holds ~10 planks across.
 */
export const PARQUET_ASH: CommonFloor = {
  material: 'parquet-ash',
  // Planks ~16 cm wide (1000 / 6.25 / 10).
  textureScale: 6.25,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  boardsAcross: 10,
  boardWidth: { min: 13, max: 22 },
  tone: 0,
  stain: [0.66, 0.5, 0.32],
  normalScale: 1,
  roughness: 1,
  metalness: 0,
}

/** The floors an artist chooses from in a baked space (AR-169); every space's own is the first. */
export const BAKED_FLOORS: readonly CommonFloor[] = [COMMON_FLOOR, PARQUET_MEDIUM, PARQUET_ASH]

/**
 * The floor a baked room shows: the exhibition's stored material when it is one of `BAKED_FLOORS`,
 * else the space's own — a material stored for the old editor (concrete, parquet-light…) never
 * shows in a baked room.
 */
export const bakedFloor = (spaceFloor: CommonFloor, stored?: string | null): CommonFloor =>
  BAKED_FLOORS.find((floor) => floor.material === stored) ?? spaceFloor

/** How the floor's boards lie: their size and placement. */
export type FloorTiling = Pick<CommonFloor, 'textureScale' | 'offsetX' | 'offsetY' | 'rotation'>

/** The floor columns an exhibition stores (`floorMaterial`, `floorTextureScale`, …). */
export interface StoredFloor {
  floorMaterial?: string | null
  floorTextureScale?: number | null
  floorTextureOffsetX?: number | null
  floorTextureOffsetY?: number | null
  floorRotation?: number | null
  /** In a baked space: the floor's tone (`CommonFloor.tone`). */
  floorTemperature?: number | null
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** The boards' width (cm) at a texture scale: one tile spans 1000 / scale cm. */
export const boardWidthCm = (floor: CommonFloor, textureScale: number): number =>
  1000 / textureScale / floor.boardsAcross

/** The texture scale that lays boards `cm` wide. */
export const textureScaleForBoardWidth = (floor: CommonFloor, cm: number): number =>
  1000 / cm / floor.boardsAcross

/** A texture scale within the floor's board widths. */
const realisticScale = (floor: CommonFloor, textureScale: number): number =>
  clamp(
    textureScale,
    textureScaleForBoardWidth(floor, floor.boardWidth.max),
    textureScaleForBoardWidth(floor, floor.boardWidth.min),
  )

/**
 * AR-163 (Eduardo 2026-10-21): in a baked space the artist sets the boards' size and placement
 * again — never the floor itself. A tiling only means something for the texture it was set on: an
 * exhibition's stored tiling counts once it was set for the space's floor (its stored material is
 * that floor's — the editor stores both together); one set for an earlier floor shows the space's
 * own tiling. A tiling never changes the light (the bake takes the floor's average color), so it
 * never stales a bake. Its size stays within the floor's board widths (AR-169).
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
    textureScale: realisticScale(floor, stored.floorTextureScale ?? floor.textureScale),
    offsetX: stored.floorTextureOffsetX ?? floor.offsetX,
    offsetY: stored.floorTextureOffsetY ?? floor.offsetY,
    rotation: stored.floorRotation ?? floor.rotation,
  }
}

/**
 * AR-169: the floor's tone in a baked space — the artist's once set for the space's floor (its
 * stored material is that floor's, like the tiling; `floorTemperature` carries it there), else the
 * space's own. 0 … 1.
 */
export const bakedFloorTone = (floor: CommonFloor, stored: StoredFloor): number =>
  stored.floorMaterial === floor.material && stored.floorTemperature != null
    ? clamp(stored.floorTemperature, 0, 1)
    : floor.tone

/** The floor's color multiplier at a tone, linear: the stain's transmittance, `stain ^ tone`. */
export const floorToneColor = (floor: CommonFloor, tone: number): [number, number, number] =>
  floor.stain.map((t) => Math.pow(t, tone)) as [number, number, number]
