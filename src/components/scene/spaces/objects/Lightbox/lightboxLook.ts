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
 * The light's color on the picture itself: a quarter of it (tuning round 2: "Cool must not turn
 * the picture blue-grey"), luminance 1. The light's full color is on what the light falls on: the
 * wall, the box's inside, the bake.
 */
export const LIGHTBOX_IMAGE_TINT_SHARE = 0.25

export const lightboxImageTint = (light: TLightboxLight): [number, number, number] => {
  const mixed = LIGHTBOX_TINT[light].map((c) => 1 + (c - 1) * LIGHTBOX_IMAGE_TINT_SHARE) as [
    number,
    number,
    number,
  ]
  const luminance = 0.2126 * mixed[0] + 0.7152 * mixed[1] + 0.0722 * mixed[2]
  return mixed.map((c) => c / luminance) as [number, number, number]
}

/**
 * Today's look (the 3D editor, a room without a bake): the image's brightness in the room's units,
 * Soft 1.1×, Bright 1.8× (× `TODAY_LOOK_FRONT`). The baked look lifts its mid-tones instead
 * (`lightboxFilm`) and never scales it: on screen a print is already the file's white.
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
 * The backlit film's character (docs/lightbox §2, tuning round 2): more vivid than a print —
 * saturation up a little — and its mid-tones lifted, Soft +15 % to Bright +35 % at middle gray, by a
 * curve that keeps black at black and white at white (a power on linear light, `lightboxFilm`):
 * near-whites keep their texture, nothing clips ("at Bright/cool the whites burn out", 2026-11-16).
 * The "too bright to look at" is the bloom's and the halo's to carry. Plus a soft fall-off from the
 * middle to the corners, and a bright line where the film meets the box.
 */
export const LIGHTBOX_FILM = {
  saturation: { soft: 1.1, bright: 1.2 },
  /** The lift of middle gray (0.18 linear): its share over the file. */
  midLift: { soft: 0.15, bright: 0.35 },
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

/** The film's saturation and its mid-tone curve's power (`< 1` lifts) at a brightness. */
export const lightboxFilm = (brightness: number) => {
  const at = (range: { soft: number; bright: number }) =>
    range.soft + (range.bright - range.soft) * brightness
  const gray = 0.18
  return {
    saturation: at(LIGHTBOX_FILM.saturation),
    power: Math.log(gray * (1 + at(LIGHTBOX_FILM.midLift))) / Math.log(gray),
  }
}

/**
 * A glossy front (tuning round 2, the default): an acrylic face's soft sheen — the room's light
 * reflected broadly (roughness 0.3) at ~7 % head on (a dielectric's 4 % × `reflect`), a faint
 * gradient that slides as the visitor walks. Never the lamps' points of light: they were sharp
 * white dots over the picture (`lightboxMaterial.ts`: the environment's reflection only).
 */
export const LIGHTBOX_GLOSS = { roughness: 0.3, reflect: 1.75 } as const

/**
 * The film sits this far behind the edge's front (a box with an edge holds it in a rebate, whose
 * sides catch its light: `LightboxRim`); edge to edge, it is the front itself.
 */
export const LIGHTBOX_RECESS_M = 0.005

/**
 * The light on the wall round the box (`LightboxWash`; tuning round 2: "a softer, wider halo, not a
 * rim"): the wall that much lighter at the box's edge, Soft +6 %, Bright +14 %, fading to nothing
 * `reach` away (m: ~25 cm at Soft, 30–50 cm at Bright), alike on all four sides, in the image's
 * average color × the light's (`colorShare` of the image's hue: a warm picture gives a warm wash).
 * A bake keeps all of it: the front faces the room, so the bake lights what faces it (the floor
 * below, the works across) and never this wall (measured, Quick bake of Florescere, 2026-11-15).
 */
export const LIGHTBOX_WASH = {
  atEdge: (brightness: number) => 0.06 + 0.08 * brightness,
  reach: (brightness: number, width: number, height: number) =>
    0.2 + 0.2 * brightness + 0.1 * Math.min(width, height),
  colorShare: 0.8,
} as const

/**
 * The image's light spilling over the box's inner lip (tuning round 2: "the image's light visibly
 * reaching the frame, not stopping at a hard line"): a thin, soft glow on the edge's front from
 * the image outwards, in the image's color × the light's, strongest at Bright — `atEdge` × a lit
 * wall's brightness at the lip, gone `reachM` out (m, never past the edge).
 */
export const LIGHTBOX_SPILL = {
  atEdge: (brightness: number) => 0.1 + 0.4 * brightness,
  reachM: (brightness: number) => 0.005 + 0.005 * brightness,
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
export const LIT_WALL = (0.8 * 2.81) / Math.PI
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
