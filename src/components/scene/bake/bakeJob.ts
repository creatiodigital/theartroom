import { Color, Vector3 } from 'three'
import type { Mesh, Scene, WebGLRenderer } from 'three'

import type { SpaceLook } from '@/lib/bake/spaceLooks'

import { BAKE_DEBUG, LUX_PER_UNIT, setBakeAllRooms } from './bakedLook'
import {
  BAKE_QUALITY,
  LightBaker,
  setBakeGrid,
  type AreaEmitter,
  type BakeReceiver,
} from './LightBaker'
import {
  bakeBouncesFlag,
  bakeClayFlag,
  bakeGroupsFlag,
  bakeQualityFlag,
  bakeSeedFlag,
  bakeVplCubeFlag,
  bakeVplClampFlag,
  bakeGridFlag,
  bakeNearBounceFlag,
  bakeScaleFlag,
} from './bakeFlags'
import { spaceSunDirection, sunEnters } from './spaceSun'
import { brightenWindows } from './daylight'
import { luminance, type BakeMeter } from './meter'
import { prepareReceivers } from './receivers'
import { MAX_FRAME, SETTLE, settleStep } from './settle'
import { inCorridor, raycastableWalls } from './zones'

/**
 * ⚠️ AR-161 — one bake of the room, start to finish: wait for the room, gather it, run
 * `LightBaker` a slice per frame, in the space's approved look (`SpaceLook`). The admin's bake
 * (`BakeRunner`) runs it.
 */

/** Seconds after mount before baking: room, floor set and artworks have streamed in. */
export const START_DELAY = 4
/** Milliseconds of bake work per frame. */
export const FRAME_BUDGET = 24
/**
 * Frames to let every room's lamps mount before gathering them: React commits the spotlights,
 * then the track spots' effects attach their aim targets.
 */
export const LAMP_MOUNT_FRAMES = 3

/**
 * Waits, in visible time (`settle.ts`), until the room has streamed in and nothing is still
 * loading (so every artwork shown is measured), then mounts every room's lamps for a few frames.
 */
export class BakeWait {
  private elapsed = 0
  private idle = 0
  private mountFrames = 0

  /** Every frame until it says yes: then gather the room (`startBake`). */
  ready(delta: number, loading: boolean): boolean {
    // A hidden tab's catch-up frame counts as one short frame.
    this.elapsed += Math.min(delta, MAX_FRAME)
    this.idle = settleStep(this.idle, delta, loading)
    if (this.elapsed < START_DELAY || this.idle < SETTLE) return false
    // Multi-room spaces cull the other rooms' lamps; the bake needs all of them.
    if (this.mountFrames === 0) setBakeAllRooms(true)
    return this.mountFrames++ >= LAMP_MOUNT_FRAMES
  }
}

export interface BakeRoom {
  /** The artist's wall color (the walls' albedo). */
  wall: string
  /** The artist's ceiling color (the ceiling's albedo). */
  ceiling: string
  /** The space's look: its lamp ratings, daylight, sun and paint. */
  look: SpaceLook
  /**
   * The ceiling-lamp dimmer's share (0.5–1): the lamps carry it already (`lookSpot`); a
   * corridor's re-rated fixtures keep it too.
   */
  recessedDimmer: number
}

export interface StartedBake {
  baker: LightBaker
  run: Generator<void, void, void>
  /** The bake's receivers (`prepareReceivers`), in `prepare` order: index = lightmap index. */
  receivers: BakeReceiver[]
  /** Their unwrap: what a stored copy of this bake records. */
  unwrap: { hash: string; stats: number[][] }
}

/**
 * Gathers the room into a `LightBaker` and starts it. Every change it makes to the room (our own
 * unwrap, the window daylight) is pushed onto `restore` as it is made, so a throw midway still
 * puts everything back.
 */
export const startBake = (
  gl: WebGLRenderer,
  scene: Scene,
  room: BakeRoom,
  restore: (() => void)[],
): StartedBake => {
  const floor = scene.getObjectByName('floor') as Mesh | undefined
  // Walls, ceiling, floor, artworks (measured only) and fixtures, on our own unwrap.
  const prepared = prepareReceivers(scene, {
    wall: room.wall,
    ceiling: room.ceiling,
    look: room.look,
  })
  restore.push(prepared.restore)
  const { receivers } = prepared
  const unwrap = { hash: prepared.unwrapHash, stats: prepared.unwrapStats }
  console.info('[AR-161 unwrap]', JSON.stringify({ hash: prepared.unwrapHash }))

  // Daylight: visible window glass emits what it shows (`brightenWindows`: the same window
  // brightness a stored bake gets).
  const lit = brightenWindows(scene, room.look.daylightGain, room.look.lightWellDaylight)
  restore.push(lit.undo)
  const emitters: AreaEmitter[] = lit.windows
  const center = new Vector3(0, 1.5, 0)
  if (floor) {
    floor.geometry.computeBoundingBox()
    floor.geometry.boundingBox!.clone().applyMatrix4(floor.matrixWorld).getCenter(center)
    center.y = 1.5
  }

  setBakeGrid(bakeGridFlag() ?? 256)
  const baker = new LightBaker(gl, scene)
  baker.quality = BAKE_QUALITY[bakeQualityFlag()]
  const bounces = bakeBouncesFlag()
  if (bounces !== null) {
    baker.quality = {
      ...baker.quality,
      bounces,
      nearSpp: bounces === 0 ? 0 : baker.quality.nearSpp,
    }
    // Exactly N bounces, as Cycles renders N: no tail for the ones left out.
    baker.tail = false
  }
  baker.nearPerBounce = bakeNearBounceFlag()
  const vplClamp = bakeVplClampFlag()
  if (vplClamp !== null) baker.vplMinDist = vplClamp
  const vplCube = bakeVplCubeFlag()
  if (vplCube !== null) baker.quality = { ...baker.quality, vplCube }
  baker.seed = bakeSeedFlag()
  try {
    return {
      baker,
      run: gatherInto(baker, scene, room, receivers, emitters, center),
      receivers,
      unwrap,
    }
  } catch (error) {
    // Nothing else holds it yet.
    baker.dispose()
    throw error
  }
}

/** The lamps, the windows' daylight and the sun, into `baker`; then it starts. */
const gatherInto = (
  baker: LightBaker,
  scene: Scene,
  room: BakeRoom,
  receivers: BakeReceiver[],
  emitters: AreaEmitter[],
  center: Vector3,
): Generator<void, void, void> => {
  const wall = scene.getObjectByName('wall0') as Mesh | undefined
  const { look } = room
  baker.prepare(receivers, emitters, center)
  // Corridors keep standard fixtures where the rooms' recessed lamps are rated up, on the same
  // dimmer (`corridorLumens`). Recessed lamps only (AR-169): a round lamp is a standard fixture
  // everywhere, on its own dimmer — Madrid's entrance and a plafond-lit Paris or Vienna corridor.
  if (wall && look.corridorLumens !== undefined) {
    const walls = raycastableWalls(wall)
    const standard = (look.corridorLumens / Math.PI / LUX_PER_UNIT) * room.recessedDimmer
    let corridorLamps = 0
    baker.rateLamps((lamp) => {
      if (!lamp.recessed || !inCorridor(walls, lamp.position)) return null
      corridorLamps++
      return standard
    })
    console.info('[AR-161 corridor]', JSON.stringify({ lamps: corridorLamps }))
  }
  // AR-169 calibration: one light group's output scaled (`?bakescale=`), to see what each adds.
  const scale = bakeScaleFlag()
  if (scale) {
    const walls = wall ? raycastableWalls(wall) : null
    baker.rateLamps((lamp) => {
      const group = !lamp.wide
        ? 'track'
        : walls && inCorridor(walls, lamp.position)
          ? 'corridor'
          : 'downlights'
      const factor = scale[group]
      return factor === undefined ? null : lamp.intensity * factor
    })
    const factor = scale.window
    if (factor !== undefined) emitters.forEach((e) => e.radiance.multiplyScalar(factor))
  }
  // AR-169 calibration: only the light groups asked for (`bakeFlags`).
  const groups = bakeGroupsFlag()
  if (groups) {
    baker.dropLamps((lamp) => !groups.has(lamp.wide ? 'downlights' : 'track'))
    // `prepare` holds this array: emptied in place.
    if (!groups.has('window')) emitters.splice(0)
  }
  console.info(
    '[AR-169 bake setup]',
    JSON.stringify({
      quality: bakeQualityFlag(),
      bounces: baker.quality.bounces,
      tail: baker.tail,
      nearSpp: baker.quality.nearSpp,
      vplCube: baker.quality.vplCube ?? 'default',
      vplClamp: baker.vplMinDist,
      grid: bakeGridFlag() ?? 256,
      nearPerBounce: baker.nearPerBounce,
      scale: bakeScaleFlag(),
      seed: baker.seed,
      clay: bakeClayFlag(),
      frontOnly: receivers.filter((r) => r.frontOnly).map((r) => r.name),
      groups: groups ? [...groups] : 'all',
      lamps: baker.stats.lamps,
      emitters: emitters.map((e) => e.mesh.name),
      // The material table this bake ran on: each receiver's linear albedo (what it bounces).
      albedo: Object.fromEntries(
        receivers.map((r) => [r.name, r.albedo.toArray().map((c) => +c.toFixed(3))]),
      ),
    }),
  )
  // Which way each emitter faces (`LightBaker.emitterTris`: its front face, as modelled).
  console.info('[AR-169 emitters]', JSON.stringify(baker.emitterFacing()))
  // Every lamp as baked, for the closed-form tests (`bakeFlags`, phase 2).
  if (BAKE_DEBUG) console.info('[AR-169 lamps]', JSON.stringify(baker.lampTable()))
  // Direct sun through each window (the space's illuminance on a surface facing it — outdoors
  // ~50–80 klx — elevation, and azimuth off straight in).
  if (look.sunLux > 0 && (!groups || groups.has('sun'))) {
    // Sunlight, white like every light in the room (AR-169: was 5,800 K, (1, 0.98, 0.95)), scaled
    // so its luminance is the asked illuminance (three units).
    const tint = new Color(1, 1, 1)
    const sunLux = look.sunLux * (scale?.sun ?? 1)
    const illuminance = tint.multiplyScalar(sunLux / LUX_PER_UNIT / luminance(tint))
    let suns = 0
    // The sun comes through every window opening — its glass rectangle, shown or not (an open
    // window hides it) — only through it (a portal), and not down a light well (a narrow shaft
    // barely sees it at the bottom).
    const openings: Mesh[] = []
    scene.traverse((o) => {
      if ((o as Mesh).isMesh && /^windowGlass\d+$/.test(o.name)) openings.push(o as Mesh)
    })
    // Each opening's glass rectangle and its inward horizontal normal (its thinnest horizontal axis,
    // pointing at the room centre).
    const windows = openings.map((mesh) => {
      mesh.updateMatrixWorld(true)
      mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
      const through = box.getCenter(new Vector3())
      const size = box.getSize(new Vector3())
      const acrossX = size.x < size.z
      const inward = acrossX ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
      if (inward.dot(center.clone().sub(through)) < 0) inward.negate()
      return { through, size, acrossX, inward, area: size.y * (acrossX ? size.z : size.x) }
    })
    // AR-169: ONE sun for the space (`spaceSun`) — through the windows it can enter.
    const direction = spaceSunDirection(windows, look.sunElevationDeg, look.sunAzimuthDeg)
    for (const { through, size, acrossX, inward } of windows) {
      if (!direction || !sunEnters(direction, inward)) continue
      const portal = {
        center: through.clone(),
        u: acrossX ? new Vector3(0, 0, size.z / 2) : new Vector3(size.x / 2, 0, 0),
        v: new Vector3(0, size.y / 2, 0),
      }
      baker.addSun(
        direction.clone(),
        illuminance,
        through,
        Math.max(size.x, size.y, size.z) + 2,
        portal,
      )
      suns++
    }
    // AR-169 (BUG 7): how many suns the baker holds as parallel light (one per window).
    const parallel = baker.lampTable().filter((l) => l.directional).length
    console.info('[AR-161 sun]', JSON.stringify({ lux: sunLux, windows: suns, parallel }))
  }
  // Lamps are captured as data: culling can resume.
  setBakeAllRooms(false)
  return baker.run()
}

/** Runs the bake for one frame's budget. True once it has finished. */
export const bakeSlice = (run: Generator<void, void, void>, budget = FRAME_BUDGET): boolean => {
  const start = performance.now()
  while (performance.now() - start < budget) if (run.next().done) return true
  return false
}

/** How far the bake is, 0..1 (the step estimate can drift: clamped). */
export const bakeFraction = (baker: LightBaker): number =>
  Math.min(1, baker.stats.steps / baker.totalSteps())

/**
 * Diagnostics (development; the headless tools read them): the meter's reading of the finished
 * bake at the camera `exposure`, and the bake's stats.
 */
export const logBake = (
  baker: LightBaker,
  meter: BakeMeter,
  exposure: number,
  camera: 'space' | 'metered',
) => {
  if (!BAKE_DEBUG) return
  const { artLight } = meter
  console.info(
    '[AR-161 meter]',
    JSON.stringify({
      artPeakLux: meter.artPeakLux,
      wallMedianLux: Math.round(meter.wallMedian * LUX_PER_UNIT),
      ceilingMedianLux: Math.round(meter.ceilingMedian * LUX_PER_UNIT),
      bounceLux: Math.round(luminance(meter.bounce) * LUX_PER_UNIT),
      artToWall: +(meter.artPeak / meter.wallMedian).toFixed(2),
      paperWhite: +(meter.paperRadiance * exposure).toFixed(3),
      exposure: +exposure.toFixed(3),
      camera,
      meteredExposure: +meter.meteredExposure.toFixed(3),
      whiteBalance: artLight
        ? [artLight.r, artLight.g, artLight.b].map((c) => +(luminance(artLight) / c).toFixed(3))
        : null,
    }),
  )
  logBakeStats(baker)
}

/** The bake's stats line, and a warning when the progress estimate drifted (development). */
export const logBakeStats = (baker: LightBaker) => {
  if (!BAKE_DEBUG) return
  console.info('[AR-161 bake]', JSON.stringify({ ...baker.stats, totalSteps: baker.totalSteps() }))
  if (process.env.NODE_ENV !== 'production' && baker.stats.steps !== baker.totalSteps()) {
    console.warn('[AR-161] bake steps', baker.stats.steps, 'expected', baker.totalSteps())
  }
}
