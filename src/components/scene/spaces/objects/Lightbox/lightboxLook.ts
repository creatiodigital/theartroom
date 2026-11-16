import {
  LIGHTBOX_EDGE_CM,
  LIGHTBOX_LIGHT_VERSION,
  type TLightbox,
  type TLightboxLight,
  type TLightboxMaterial,
} from '@/lib/lightbox'

/**
 * AR-183 — how a lightbox reads in the 3D room (docs/lightbox "How it looks in the 3D room"). One
 * place for its numbers: the front's shader, the box and the bake's emitter read them, so what the
 * visitor sees and what the bake lights agree.
 *
 * Tuning round 1 (owner, 2026-11-15, after photos of real lightboxes): its image brighter and more
 * vivid than any print beside it — deep blacks, its brightest parts burning towards white — and,
 * since on screen a print's whites are already the screen's white (every artwork is shown as its
 * file), the two signs a screen has that something is a light, both very subtle: a glow round its
 * edge, and its light on the wall round it. The image alone read as "just an image with different
 * colors"; stronger glows, and a column of light above the box, were tried that day and dropped.
 */

/**
 * The light's color as the room's camera sees it: linear RGB, luminance 1 (a color change never
 * changes how bright it is). The rooms are balanced to their white lamps, so the Neutral light
 * (≈4000 K) is that white, and the others are blackbodies seen against it: 3000 K over 4000 K
 * (warm, ≈ #ffdeab), 6500 K over 4000 K (cool, ≈ #a6c3ff). CIE 1931 Planckian locus (Kim et al.)
 * → XYZ → linear sRGB, divided by the 4000 K white.
 */
export const LIGHTBOX_TINT: Record<TLightboxLight, [number, number, number]> = {
  warm: [1.305, 0.956, 0.534],
  neutral: [1, 1, 1],
  cool: [0.696, 1.006, 1.833],
}

/**
 * The image's brightness over the file: Soft (0) 1.1×, Bright (1) 1.8× (tuning round 1, owner
 * 2026-11-15: lifted at Soft already, Bright's top kept). Shown on screen it rolls off before
 * white (`lightboxShoulder`): whites stay whites, the rest of the picture lifts. A print next to
 * it is the file exactly.
 */
export const lightboxGain = (brightness: number): number => 1.1 + 0.7 * brightness

/**
 * Today's look (the 3D editor, a room without a bake: tone mapping on the whole picture, bloom
 * over 2.0): the front in the room's units. Soft whites 1.32 (no glow), Bright 2.16: just past the
 * bloom threshold, a faint rim as in the baked look.
 */
export const TODAY_LOOK_FRONT = 1.2

/**
 * The baked look shows the image on screen past the camera (as every artwork file there,
 * `artworkFile.ts`); bloom sees it × this feed. The room's glow is the lamps' there (threshold 16,
 * strength ÷ 8: `lampGlowScale`) — and the lightboxes': its whites at `LIGHTBOX_HALO` × the
 * threshold, just past it: a very subtle glow round the box (owner, 2026-11-15: "a bloom around,
 * but very subtle"; at 1.5–3× it read strong on his screen). At most `LIGHTBOX_FEED_MAX`.
 */
export const lightboxBloomFeed = (brightness: number, threshold: number): number =>
  Math.min(
    LIGHTBOX_FEED_MAX,
    threshold * (LIGHTBOX_HALO.soft + (LIGHTBOX_HALO.bright - LIGHTBOX_HALO.soft) * brightness),
  )

/** The front's whites as bloom sees them, × its threshold: at Soft, at Bright. */
export const LIGHTBOX_HALO = { soft: 1.2, bright: 2 } as const

/** The largest feed the alpha can carry (`LIGHTBOX_ALPHA`). */
export const LIGHTBOX_FEED_MAX = 1024

/**
 * The marker a lightbox's front writes in alpha, carrying its bloom feed: 0.2 (feed 1) to 0.4
 * (`LIGHTBOX_FEED_MAX`), on a log scale (`lightboxFeedAlpha`): the screen's half-float alpha then
 * carries any feed to within 0.5 %, so dividing it back out leaves the picture as it was. The
 * artwork marker is 0.5 (`ARTWORK_FILE_ALPHA`, with its antialiased edges up to 1); nothing else
 * in the room writes below 0.45.
 */
export const LIGHTBOX_ALPHA = { min: 0.2, max: 0.4 } as const

/** The alpha a front writes for its feed (≥ 1), and back (`ArtworkFileEffect`). */
export const lightboxFeedAlpha = (feed: number): number =>
  LIGHTBOX_ALPHA.min +
  ((LIGHTBOX_ALPHA.max - LIGHTBOX_ALPHA.min) * Math.log2(Math.max(feed, 1))) /
    Math.log2(LIGHTBOX_FEED_MAX)
export const lightboxAlphaFeed = (alpha: number): number =>
  2 **
  (((alpha - LIGHTBOX_ALPHA.min) / (LIGHTBOX_ALPHA.max - LIGHTBOX_ALPHA.min)) *
    Math.log2(LIGHTBOX_FEED_MAX))

/**
 * The backlit film's character (docs/lightbox §2, fixed, not settings): more vivid than a print —
 * saturation up, and a contrast that deepens the darks and keeps white at white (a power on linear
 * light), both a little more at Bright (`lightboxFilm`) — a soft fall-off from the middle to the
 * corners, and a bright line where the film meets the box.
 */
export const LIGHTBOX_FILM = {
  saturation: { soft: 1.15, bright: 1.25 },
  contrast: { soft: 1.1, bright: 1.2 },
  /** At the corners; half that at the middle of each side. */
  falloff: 0.08,
  /**
   * The light leak: how far towards the light the film goes at its edge, over this width of film
   * (m; tuning round 1: 2–3 mm, so it holds from across the room — a pixel wider than the line
   * shows its share of it, never a flicker).
   */
  leak: 0.8,
  leakM: 0.0025,
} as const

/** The film's saturation and contrast at a brightness (`LIGHTBOX_FILM`). */
export const lightboxFilm = (brightness: number) => {
  const at = (range: { soft: number; bright: number }) =>
    range.soft + (range.bright - range.soft) * brightness
  return { saturation: at(LIGHTBOX_FILM.saturation), contrast: at(LIGHTBOX_FILM.contrast) }
}

/**
 * The film sits this far behind the edge's front (a box with an edge holds it in a rebate, whose
 * sides catch its light: `LightboxRim`); edge to edge, it is the front itself.
 */
export const LIGHTBOX_RECESS_M = 0.005

/**
 * The light on the wall round the box (`LightboxWash`; owner, 2026-11-15, after a column of light
 * above it and no glow at all were tried: "a bloom around, but very subtle"): the wall that much
 * lighter at the box's edge, Soft +10 %, Bright +20 %, in the light's color, fading to nothing
 * `reach` away (m: ~15 cm), alike on all four sides. A bake keeps all of it: the front faces the
 * room, so the bake lights what faces it (the floor below, the works across) and never this wall
 * (measured, Quick bake of Florescere, 2026-11-15).
 */
export const LIGHTBOX_WASH = {
  atEdge: (brightness: number) => 0.1 + 0.1 * brightness,
  reach: (width: number, height: number) => 0.12 + 0.04 * Math.min(width, height),
} as const

/** The box around the image (m): the edge's width each side, and its depth from the wall. */
export const lightboxBox = (lightbox: TLightbox) => ({
  edge: LIGHTBOX_EDGE_CM[lightbox.lightboxEdge] / 100,
  depth: lightbox.lightboxDepth / 100,
})

/**
 * The panel's light behind the film, in the room's units (radiance: `bakedLook.ts`, one unit
 * ≈ 71 lx, a wall of reflectance 0.8 under the museum's 200 lx at 0.72): a real lightbox is 10–20×
 * as bright as a lit wall (tuning round 1), Soft to Bright. The bake's emitter is this × what the
 * film lets through (`lightboxEmitters`); the box's inside catches it (`LightboxRim`).
 */
const LIT_WALL = (0.8 * 2.81) / Math.PI
export const lightboxPanel = (brightness: number): number => LIT_WALL * (10 + 10 * brightness)

/**
 * How much of the film's light the box gives back where it sees it (the rebate's sides), linear
 * RGB: black anodized barely (its sheen), brushed aluminum as a dull mirror,
 * white paint the most, the woods in their color (the box's own colors, `Lightbox.tsx`).
 */
export const LIGHTBOX_REFLECT: Record<TLightboxMaterial, [number, number, number]> = {
  'alu-black': [0.05, 0.05, 0.05],
  'alu-silver': [0.62, 0.64, 0.66],
  white: [0.88, 0.87, 0.84],
  oak: [0.46, 0.27, 0.12],
  walnut: [0.1, 0.044, 0.02],
}

/**
 * The rebate's sides (`LightboxRim`), × the panel's light: half of it (a side beside the film sees
 * it fill half its sky).
 */
export const LIGHTBOX_RIM_SIDES = 0.5

/**
 * A lightbox's front as a bake lit the room with it (`lightboxEmitters`, `BakeRecord.lightboxes`):
 * how bakes light with one (`LIGHTBOX_LIGHT_VERSION`), where it hangs, its size, and what changes
 * its light — brightness, light color, depth (where its front stands) and edge. Recorded with
 * the bake; the same work under another key (moved, resized, made brighter…) was not in it.
 */
export const lightboxBakeKey = (
  at: { x: number; y: number; z: number },
  turn: { x: number; y: number; z: number; w: number },
  width: number,
  height: number,
  lightbox: TLightbox,
): string =>
  [
    `v${LIGHTBOX_LIGHT_VERSION}`,
    [at.x, at.y, at.z].map((v) => v.toFixed(3)).join(','),
    [turn.x, turn.y, turn.z, turn.w].map((v) => v.toFixed(4)).join(','),
    `${width.toFixed(3)}x${height.toFixed(3)}`,
    lightbox.lightboxBrightness.toFixed(2),
    lightbox.lightboxLight,
    lightbox.lightboxDepth.toFixed(1),
    lightbox.lightboxEdge,
  ]
    .join('|')
    .replace(/-0\.0+(?=[,|x]|$)/g, (zero) => zero.slice(1))
