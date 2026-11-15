import { LIGHTBOX_EDGE_CM, type TLightbox, type TLightboxLight } from '@/lib/lightbox'

/**
 * AR-183 — how a lightbox reads in the 3D room (docs/lightbox "How it looks in the 3D room"). One
 * place for its numbers: the front's shader, the box, the wall glow and the bake's emitter read
 * them, so what the visitor sees and what the bake lights agree.
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
 * The image's brightness over paper white: Soft (0) is the file as printed, Bright (1) 1.8× it
 * (the spec's 1.0–1.8). Shown on screen it rolls off before white (`lightboxShoulder`): whites
 * stay whites, the rest of the picture lifts.
 */
export const lightboxGain = (brightness: number): number => 1 + 0.8 * brightness

/**
 * Today's look (the 3D editor, a room without a bake: tone mapping on the whole picture, bloom
 * over 2.0): the front in the room's units. Soft whites 1.3 (no glow), Bright 2.3 (past the bloom
 * threshold, as a light). 1.6 read washed out in the editor at Bright (2026-11-15).
 */
export const TODAY_LOOK_FRONT = 1.3

/**
 * The baked look shows the image on screen past the camera (as every artwork file there,
 * `artworkFile.ts`); bloom sees it × this feed (the room's glow threshold is 16 there:
 * `lampGlowScale`). Whites of a Soft box sit just below it (no halo), Bright ones well over it,
 * like a lamp's disc.
 */
export const lightboxBloomFeed = (brightness: number, threshold: number): number =>
  threshold * (0.9 + 0.7 * brightness)

/** The largest feed the alpha can carry (`LIGHTBOX_ALPHA`). */
export const LIGHTBOX_FEED_MAX = 64

/**
 * The marker a lightbox's front writes in alpha, carrying its bloom feed: from 0.2 (none) to 0.4
 * (`LIGHTBOX_FEED_MAX`). The artwork marker is 0.5 (`ARTWORK_FILE_ALPHA`, with its antialiased
 * edges up to 1); nothing else in the room writes below 0.45.
 */
export const LIGHTBOX_ALPHA = { min: 0.2, max: 0.4 } as const

/**
 * The backlit film's character (docs/lightbox §2, fixed, not settings): a gentle saturation and
 * contrast lift, a soft fall-off from the middle to the corners, and a thin bright line where the
 * film meets the box.
 */
export const LIGHTBOX_FILM = {
  saturation: 1.1,
  /** Contrast around middle gray (a power on linear light: blacks stay black). */
  contrast: 1.06,
  /** At the corners; half that at the middle of each side. */
  falloff: 0.08,
  /** How far towards the light the edge's pixels go, and over how many pixels. */
  leak: 0.45,
  leakPx: 1.5,
} as const

/**
 * The film sits this far behind the edge's front (a box with an edge holds it in a rebate);
 * edge to edge, it is the front itself.
 */
export const LIGHTBOX_RECESS_M = 0.002

/** The box around the image (m): the edge's width each side, and its depth from the wall. */
export const lightboxBox = (lightbox: TLightbox) => ({
  edge: LIGHTBOX_EDGE_CM[lightbox.lightboxEdge] / 100,
  depth: lightbox.lightboxDepth / 100,
})

/**
 * The fallback wash on the wall around the box (shown until a bake lights the room with it): at
 * the box's edge, this share of the front's white, fading out over `reach` (m).
 */
export const LIGHTBOX_GLOW = {
  atEdge: 0.12,
  reach: (width: number, height: number) => 0.18 + 0.2 * Math.min(width, height),
} as const
