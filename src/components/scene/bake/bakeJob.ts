import { Color, Vector3 } from 'three'
import type { Mesh, Scene, WebGLRenderer } from 'three'

import type { SpaceLook } from '@/lib/bake/spaceLooks'

import { BAKE_DEBUG, LUX_PER_UNIT, setBakeAllRooms } from './bakedLook'
import { LightBaker, type AreaEmitter, type BakeReceiver } from './LightBaker'
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
  const lit = brightenWindows(scene, room.look.daylightGain)
  restore.push(lit.undo)
  const emitters: AreaEmitter[] = lit.windows
  const center = new Vector3(0, 1.5, 0)
  if (floor) {
    floor.geometry.computeBoundingBox()
    floor.geometry.boundingBox!.clone().applyMatrix4(floor.matrixWorld).getCenter(center)
    center.y = 1.5
  }

  const baker = new LightBaker(gl, scene)
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
  // dimmer (the space's `corridorLumens`).
  if (wall && look.corridorLumens !== undefined) {
    const walls = raycastableWalls(wall)
    const standard = (look.corridorLumens / Math.PI / LUX_PER_UNIT) * room.recessedDimmer
    let corridorLamps = 0
    baker.rateLamps((lamp) => {
      if (!lamp.wide || !inCorridor(walls, lamp.position)) return null
      corridorLamps++
      return standard
    })
    console.info('[AR-161 corridor]', JSON.stringify({ lamps: corridorLamps }))
  }
  // Direct sun through each window (the space's illuminance on a surface facing it — outdoors
  // ~50–80 klx — elevation, and azimuth off straight in).
  if (look.sunLux > 0) {
    const elevation = (look.sunElevationDeg * Math.PI) / 180
    const azimuth = (look.sunAzimuthDeg * Math.PI) / 180
    // Sunlight ~5,800 K (near neutral), scaled so its luminance is the asked illuminance (three units).
    const tint = new Color(1, 0.98, 0.95)
    const illuminance = tint.multiplyScalar(look.sunLux / LUX_PER_UNIT / luminance(tint))
    let suns = 0
    // The sun comes through every window opening — its glass rectangle, shown or not (an open
    // window hides it) — only through it (a portal), and not down a light well (a narrow shaft
    // barely sees it at the bottom).
    const openings: Mesh[] = []
    scene.traverse((o) => {
      if ((o as Mesh).isMesh && /^windowGlass\d+$/.test(o.name)) openings.push(o as Mesh)
    })
    for (const mesh of openings) {
      mesh.updateMatrixWorld(true)
      mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)
      const through = box.getCenter(new Vector3())
      const size = box.getSize(new Vector3())
      // The glass plane's inward horizontal normal: its thinnest horizontal axis, pointing
      // at the room centre.
      const acrossX = size.x < size.z
      const inward = acrossX ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
      if (inward.dot(center.clone().sub(through)) < 0) inward.negate()
      const horizontal = inward.applyAxisAngle(new Vector3(0, 1, 0), azimuth)
      const direction = horizontal
        .multiplyScalar(Math.cos(elevation))
        .add(new Vector3(0, -Math.sin(elevation), 0))
      const portal = {
        center: through.clone(),
        u: acrossX ? new Vector3(0, 0, size.z / 2) : new Vector3(size.x / 2, 0, 0),
        v: new Vector3(0, size.y / 2, 0),
      }
      baker.addSun(direction, illuminance, through, Math.max(size.x, size.y, size.z) + 2, portal)
      suns++
    }
    console.info('[AR-161 sun]', JSON.stringify({ lux: look.sunLux, windows: suns }))
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
