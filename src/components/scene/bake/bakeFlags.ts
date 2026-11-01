import { BAKE_DEBUG } from './bakedLook'

/**
 * ⚠️ AR-169 calibration flags on the bake page (plan docs/superpowers/plans/2026-10-30-lighting-
 * calibration.md, phase 1). Development and staging only (`BAKE_DEBUG`): a production bake never
 * reads them, so it is always whole.
 *
 * - `?bakequality=quick`: `BAKE_QUALITY.quick` — the same light with fewer samples (the admin's
 *   Quick bake: read in production too, never stored — `bakeQualityFlag`).
 * - `?bakegroups=window,sun,downlights,track`: only these light groups light the bake (light is
 *   linear: the groups' bakes add up to the whole room's), to weigh each group on its own.
 * - `?bakeseed=N`: another sequence of random numbers (lamp jitter, light placement, near-field
 *   rays) — two seeds measure the bake's own noise.
 * - `?bakeclay=1` (bake and review pages): every surface a neutral `CLAY_ALBEDO`, in the bake and on
 *   screen — the light without the paint, as the Cycles reference renders it.
 * - `?falsecolor=1` (any page of a baked room): exposure bands instead of the tone curve
 *   (`FalseColorEffect`).
 * - `?baketwosided=1`: walls, ceiling and floor take light on both faces again, as before the
 *   front-only fix (`BakeReceiver.frontOnly`) — its A/B.
 * - `?bakebounces=N`: N bounces instead of the quality's; 0 = direct light only (no bounce, no
 *   tail, no near field), for the closed-form tests (phase 2) and Cycles' 0 / 1 / N (phase 3).
 * - `?bakevplcube=N`: the bounce lights' (and the windows') shadow cube size, to test its effect.
 * - `?bakenearbounce=0`: each bounce's corner light (what the bounce lights' clamp drops) only once
 *   at the end, as before BUG 8's fix (default: added before every next bounce).
 * - `?bakescale=downlights:0.5,track:0.5`: one light group's output scaled for a trial (main-room
 *   `downlights`, `corridor` lamps, `track`, `window` daylight, `sun`) — to see what each adds.
 * - `?exposure=E` (any page of a baked room): the camera's exposure, to compare.
 * - `?bakegrid=N`: the bounce grid per surface (default 256): the next bounce's lights are drawn
 *   from it.
 * - `?bakevplclamp=M`: the bounce lights' singularity clamp in meters (default 0.5); the near field
 *   that adds back what it drops follows it.
 */
export type BakeGroup = 'window' | 'sun' | 'downlights' | 'track'

const param = (name: string): string | null =>
  BAKE_DEBUG && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(name)
    : null

/**
 * `?bakequality=quick`: the admin's Quick bake (Eduardo 2026-10-31: "better than no bake, less
 * quality, faster… just for calibrating, before I press the real Bake"). Read everywhere, not only
 * in development: a quick bake is never uploaded or saved (`BakeRunner`), so no visitor can get it.
 */
export const bakeQualityFlag = (): 'full' | 'quick' =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('bakequality') === 'quick'
    ? 'quick'
    : 'full'

/** The groups asked for, or null for all of them. */
export const bakeGroupsFlag = (): ReadonlySet<BakeGroup> | null => {
  const value = param('bakegroups')
  return value ? new Set(value.split(',').map((g) => g.trim()) as BakeGroup[]) : null
}

/** The seed asked for (a whole number ≥ 1), or 0: the bake's own sequence. */
export const bakeSeedFlag = (): number => {
  const seed = Number(param('bakeseed'))
  return Number.isInteger(seed) && seed > 0 ? seed : 0
}

/** Clay's albedo: Cycles' usual neutral grey for transport tests. */
export const CLAY_ALBEDO = 0.8

export const bakeClayFlag = (): boolean => param('bakeclay') === '1'

export const falseColorFlag = (): boolean => param('falsecolor') === '1'

export const bakeTwoSidedFlag = (): boolean => param('baketwosided') === '1'

/** The bounces asked for (a whole number ≥ 0), or null: the quality's own. */
export const bakeBouncesFlag = (): number | null => {
  const value = param('bakebounces')
  const bounces = value === null || value === '' ? NaN : Number(value)
  return Number.isInteger(bounces) && bounces >= 0 ? bounces : null
}

/** The bounce lights' shadow cube size asked for (16–2048), or null: the bake's own. */
export const bakeVplCubeFlag = (): number | null => {
  const size = Number(param('bakevplcube'))
  return Number.isInteger(size) && size >= 16 && size <= 2048 ? size : null
}

/** The bounce lights' clamp asked for (0.05–2 m), or null: the bake's own. */
export const bakeVplClampFlag = (): number | null => {
  const value = param('bakevplclamp')
  const meters = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(meters) && meters >= 0.05 && meters <= 2 ? meters : null
}

/** The bounce grid asked for (64–1024, a power of two), or null: the bake's own (256). */
export const bakeGridFlag = (): number | null => {
  const size = Number(param('bakegrid'))
  return [64, 128, 256, 512, 1024].includes(size) ? size : null
}

/** The per-bounce near field: on unless `?bakenearbounce=0` (its A/B). */
export const bakeNearBounceFlag = (): boolean => param('bakenearbounce') !== '0'

export type ScaleGroup = 'downlights' | 'corridor' | 'track' | 'window' | 'sun'

/** The light groups asked to be scaled (`group:factor`, comma separated), or null. */
export const bakeScaleFlag = (): Partial<Record<ScaleGroup, number>> | null => {
  const value = param('bakescale')
  if (!value) return null
  const scale: Partial<Record<ScaleGroup, number>> = {}
  for (const part of value.split(',')) {
    const [group, factor] = part.split(':')
    const n = Number(factor)
    if (group && Number.isFinite(n) && n >= 0) scale[group.trim() as ScaleGroup] = n
  }
  return Object.keys(scale).length ? scale : null
}

/** The camera exposure asked for (0.05–20), or null: the bake's own. */
export const cameraExposureFlag = (): number | null => {
  const value = param('exposure')
  const exposure = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(exposure) && exposure >= 0.05 && exposure <= 20 ? exposure : null
}

/**
 * `?matlift=X` (AR-169): another lift for the passepartout in the baked look than
 * `PASSEPARTOUT_LIFT` — × its color, lit like the frame (Eduardo 2026-10-31: "a little brighter
 * than it should be"). 1: exactly its color; up to 3.
 */
export const matLiftFlag = (): number | null => {
  const value = param('matlift')
  const lift = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(lift) && lift >= 1 && lift <= 3 ? lift : null
}

/**
 * AR-169 trial (`?glare=G`, Eduardo 2026-10-31: "can we add a very tiny bloom? very subtle"):
 * the bloom's threshold back down to `BLOOM_THRESHOLD` (2.0, above what lit walls reach) so the
 * window glass and the sun patches glow a little too, at G × today's glow strength. The same single
 * bloom pass — no extra GPU work. Unset: the approved lamps-only bloom.
 */
export const glareFlag = (): number | null => {
  const value = param('glare')
  const g = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(g) && g > 0 && g <= 10 ? g : null
}

/**
 * The sun's beams (`SunBeams`): their haze × S. Eduardo 2026-10-31 on S 3: "I love it! This is
 * exactly what I wanted… keep it subtle"; then, in every room: "too much… it blocks you a little
 * from appreciating the wall and the artworks — really subtle, almost unnoticeable" → 0.5 (over
 * Vienna's dark red panel: 3 → ~100 levels at most, 1 → 47, 0.5 ≈ 25). `?sunbeam=S` (0 = off).
 */
export const SUNBEAM_STRENGTH = 0.5

export const sunbeamStrength = (): number => {
  const value = param('sunbeam')
  const s = value === null || value === '' ? NaN : Number(value)
  return Number.isFinite(s) && s >= 0 && s <= 20 ? s : SUNBEAM_STRENGTH
}
