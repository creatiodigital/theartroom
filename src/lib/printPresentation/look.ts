import { fnv1a } from '@/lib/bake/hash'

/**
 * Print presentations: every artwork shown as a photo of the real print on a white wall. See
 * docs/superpowers/specs/2026-10-28-print-presentations-design.md.
 *
 * Every piece hangs a little differently, so no two shots look alike: a seed (one per artwork)
 * picks the light's exact angle, how soft the shadows are, how far the piece stands off the wall,
 * how the paper curls, which stretch of board the frame is cut from, and the pencilled copy
 * number. The light always adds up to the same white wall.
 *
 * 🔒 The look was approved by the owner on 2026-10-28. Don't retune it. Bump LOOK_VERSION when it
 * changes on purpose (every presentation then reads as out of date), and only ever APPEND draws
 * to `makeLook`: each draw shifts every value after it.
 */

/** Bumped whenever the rendered look changes, so every presentation re-renders. */
export const LOOK_VERSION = 2

/** Framed: open editions and works not for sale. Limited: the numbered sheet. */
export type PresentationMode = 'framed' | 'limited'

export type Vec3 = [number, number, number]

export type Look = {
  /** The key light (upper left, in front) and its share of the wall's light. */
  key: Vec3
  keyShare: number
  /** Faint lights from below and the right: a whisper of shadow on the top and left edges. */
  fills: { position: Vec3; share: number }[]
  /** Penumbra size (drei SoftShadows). */
  softness: number
  /** Limited: the sheet off the wall. Framed: the frame on its bumpers. */
  standoff: number
  /** Framed: the sheet behind the frame's front (glass and spacers): deep enough for the frame to shade it. */
  setBack: number
  /** Limited: how far each corner of the sheet curls off the wall (TL, TR, BL, BR), and the edges. */
  cornerLift: [number, number, number, number]
  edgeLift: number
  /** Framed: where on the board the frame's wood was cut, and how much board one texture tile is. */
  woodOffset: [number, number]
  woodTileM: number
  /** Limited: which copy this is (the pencilled "copy/N"). */
  copy: number
  /** Framed: each of the four bars comes from its own stretch of board. */
  barOffsets: [number, number][]
}

/** Small, seeded PRNG (mulberry32): the same artwork always gets the same shot. */
export const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** An artwork's seed: its id, hashed (32-bit FNV-1a). */
export function seedForArtwork(artworkId: string): number {
  return parseInt(fnv1a(artworkId), 16)
}

export function makeLook(seed: number, mode: PresentationMode, edition: number): Look {
  const r = random(seed)
  const between = (a: number, b: number) => a + (b - a) * r()
  return {
    key: [between(-1.4, -0.5), between(1.3, 2.2), 2.4],
    keyShare: between(0.07, 0.11),
    fills: [
      { position: [between(-0.2, 0.9), between(-1.9, -1.2), 2.4], share: between(0.01, 0.03) },
      { position: [between(1.2, 1.9), between(-0.2, 0.8), 2.4], share: between(0.01, 0.03) },
    ],
    softness: between(180, 300),
    standoff: mode === 'limited' ? between(0.006, 0.013) : between(0.002, 0.006),
    setBack: between(0.015, 0.025),
    // Most corners lie nearly flat; now and then one curls a few millimetres.
    cornerLift: [0, 0, 0, 0].map(() =>
      r() < 0.6 ? between(0, 0.0012) : between(0.0015, 0.004),
    ) as Look['cornerLift'],
    edgeLift: between(0, 0.0008),
    woodOffset: [r(), r()],
    woodTileM: between(0.26, 0.36),
    copy: 1 + Math.floor(r() * edition),
    barOffsets: [0, 1, 2, 3].map(() => [r(), r()]),
  }
}
