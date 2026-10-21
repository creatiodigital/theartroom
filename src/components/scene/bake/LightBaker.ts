import {
  Box3,
  BufferAttribute,
  Color,
  CubeCamera,
  CustomBlending,
  DoubleSide,
  FloatType,
  HalfFloatType,
  LinearFilter,
  Matrix3,
  Mesh,
  OneFactor,
  AddEquation,
  NearestFilter,
  NoBlending,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  type BufferGeometry,
  type Material,
  type Object3D,
  type SpotLight,
  type Texture,
  type WebGLRenderer,
} from 'three'

import {
  COMBINE_FRAGMENT,
  DILATE_FRAGMENT,
  DIRECTION_FRAGMENT,
  DISTANCE_FRAGMENT,
  DISTANCE_VERTEX,
  FULLSCREEN_VERTEX,
  CHART_FRAGMENT,
  CHART_VERTEX,
  GATHER_SIDE_FRAGMENT,
  GEOMETRY_FRAGMENT,
  NEAR_FRAGMENT,
  NEAR_VERTEX,
  RESOLVE_FRAGMENT,
  SPOT_FRAGMENT,
  UV_SPACE_VERTEX,
  VPL_FRAGMENT,
} from './bakeShaders'
import { isWorldVisible } from './daylight'
import { buildGatherScene, TriangleKind, type GatherSource } from './gatherScene'
import { BAKE_SURFACES, type BakeMapKind, type BakeSurface } from '@/lib/bake/bakeRecord'

/**
 * ⚠️ AR-161 — THE LIGHT BAKER. The admin's computer bakes an exhibition's lighting into the
 * room's static surfaces (walls, ceiling, floor, fixtures), stored and shown to visitors as it is:
 *
 *   1. Direct light from every lamp that is actually on, where it is actually aimed — three's
 *      own SpotLight model (wide diffusers: an exact cosine), with real shadows (one lamp at a
 *      time, so the 16-texture-unit limit that rules out realtime shadows does not apply). Each
 *      lamp is jittered over its LED aperture, so shadows are sharp at contact and soften with
 *      distance, as real ones do. The sun, through each window's glass only.
 *   1b. Daylight: window glass as area emitters.
 *   2. Bounce light by instant radiosity: lit surface patches become virtual point lights that
 *      re-emit their radiosity (albedo × irradiance) with a cosine lobe, with shadows, in float;
 *      the bounces not simulated added as the radiosity ambient tail. Corners and the floor line
 *      darken because they see less of the room — physically, not by an AO fudge.
 *   4. Near-field compensation: what the bounce lights' distance clamp drops in inside corners,
 *      added back by short rays (`nearField`).
 *
 * The random numbers (lamp jitter, light placement) come from one fixed sequence, restarted every
 * bake: the same room with the same lamps bakes identically every time.
 *
 * Output per receiver: an HDR irradiance lightmap in that receiver's own UVs.
 */

const CASTER_LAYER = 29

const LAMP_JITTER = 12
const LAMP_APERTURE = 0.03 // metres — an LED track head
const DIFFUSER_APERTURE = 0.15 // metres — a plafond / opal downlight's diffuser (Ø 30 cm)
const LAMP_FRONT_OFFSET = 0.04 // metres — the emitting face sits in front of the fixture's origin
const SHADOW_SIZE = 2048
// Bounce lights: 4,096 per bounce, each jittered within its texel (noise ∝ 1/√N; a regular grid
// of them showed as rows of spots near corners), 8 bounces, accumulated in float.
const VPL_COUNT = 4096
const VPL_BOUNCES = 8
// Daylight samples across all window glass: the window frame and reveals sit close to the glass,
// and fewer, more widely spaced samples showed them as blotches.
const EMITTER_VPLS = 4096
const VPL_CUBE_SIZE = 128
const LAMP_CUBE_SIZE = 1024 // wide diffusers' shadow cube (see SPOT_FRAGMENT)
// meters — instant-radiosity singularity clamp (fireflies below this); what it drops near
// surfaces — inside corners — comes back by short rays (see `nearField`).
const VPL_MIN_DIST = 0.5
const NEAR_SPP = 256
const RAYS_PER_PASS = 8
// The bake's random numbers (lamp-disc jitter, VPL placement) come from one fixed sequence
// restarted at every bake, so the same room with the same lamps bakes identically — otherwise
// each bake of a room lands 1–2% apart (Eduardo 2026-10-18: no per-exhibition drift).
const BAKE_SEED = 0x161

/** mulberry32 — a small seeded generator, uniform in [0, 1). */
const seededRandom = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// How far past a window's glass its wall still stands (the reveal shading the sun); anything
// further out is outdoors and casts no sun shadow. Paris/Vienna walls: ~0.32 m outside the glass.
const PORTAL_WALL_DEPTH = 0.5

const GRID = 128

/**
 * A surface that emits light into the room — window glass showing the sky. It faces the room
 * center (single planes of either winding).
 */
export interface AreaEmitter {
  mesh: Mesh
  /** Linear radiance as seen (emissive × intensity): what you see is what lights the room. */
  radiance: Color
}

export interface BakeReceiver {
  name: string
  mesh: Mesh
  size: number
  /** Linear-RGB diffuse reflectance of the surface (for the bounce it emits). */
  albedo: Color
  /** Denoise the bounce. Only for single-chart UVs (a quad): see COMBINE_FRAGMENT. */
  smoothBounce?: boolean
  /** Also bake a directional lightmap (where the direct light comes from), for normal maps. */
  directional?: boolean
  /**
   * Display only: its sources show their own color over the baked light × this (the panels: the
   * paint reflectance, as the walls' albedo carries it). 1 when unset.
   */
  lightMapIntensity?: number
  /** Skip the lamps' direct light (the receiver gets it in realtime): daylight + bounce only. */
  noLampDirect?: boolean
  /** Not a bounce source (small, measured only — e.g. the artworks). */
  noEmit?: boolean
  /** Scene meshes this receiver stands for (its proxy replaces them in the near-field rays). */
  sources?: Object3D[]
}

interface ReceiverState extends BakeReceiver {
  proxy: Mesh
  accum: WebGLRenderTarget
  accumBounce: WebGLRenderTarget
  grid: WebGLRenderTarget[] // one per bounce source: [direct, bounce1, ...]
  position: Float32Array
  normal: Float32Array
  texelArea: number
  normalWorld: Matrix3
  /** Resolution of the bounce accumulation. */
  bounceSize: number
  /** Σ direction × luminance of the direct light (directional receivers only). */
  dirAccum: WebGLRenderTarget | null
}

interface Lamp {
  position: Vector3
  direction: Vector3
  color: Color // linear colour × intensity
  coneCos: number
  penumbraCos: number
  decay: number
  cutoff: number
  angle: number
  /** Radius of the emitting surface: sets how fast shadows soften with distance. */
  aperture: number
  /** A 90° field: shadows from a cube map, not a (170°) perspective one. */
  wide: boolean
  /**
   * Lights only the room side of a surface (the sun). Walls and ceiling are single planes whose
   * outer face shares the inner face's texels: a sun on the roof would light the ceiling.
   */
  oneSided?: boolean
  /**
   * The window the light comes through (the sun): a surface is lit only if its ray to the light
   * crosses this rectangle — centre and half-extent axes in the glass plane.
   */
  portal?: { center: Vector3; u: Vector3; v: Vector3 }
}

const isLampPart = (object: Object3D) => {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (/lamp|bulb/i.test(o.name)) return true
  }
  return false
}

const worldArea = (geometry: BufferGeometry, mesh: Mesh) => {
  const pos = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const count = index ? index.count : pos.count
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  let area = 0
  for (let i = 0; i < count; i += 3) {
    const ia = index ? index.getX(i) : i
    const ib = index ? index.getX(i + 1) : i + 1
    const ic = index ? index.getX(i + 2) : i + 2
    a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld)
    b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld)
    c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld)
    area += b.sub(a).cross(c.sub(a)).length() / 2
  }
  return area
}

const additive = (material: ShaderMaterial) => {
  material.blending = CustomBlending
  material.blendSrc = OneFactor
  material.blendDst = OneFactor
  material.blendEquation = AddEquation
  material.blendSrcAlpha = OneFactor
  material.blendDstAlpha = OneFactor
  material.blendEquationAlpha = AddEquation
  material.depthTest = false
  material.depthWrite = false
  material.side = DoubleSide
  return material
}

export class LightBaker {
  private renderer: WebGLRenderer
  private scene: Scene
  private receivers: ReceiverState[] = []
  private lamps: Lamp[] = []
  private casters: Mesh[] = []
  private random: () => number = seededRandom(BAKE_SEED)
  private bakeScene = new Scene()
  private quadScene = new Scene()
  private quad = new Mesh(new PlaneGeometry(2, 2))
  private quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private dummyCamera = new PerspectiveCamera()
  private shadowCamera = new PerspectiveCamera(60, 1, 0.02, 80)
  private shadowRT = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, {
    type: FloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  })
  private cubeRT = new WebGLCubeRenderTarget(VPL_CUBE_SIZE, {
    type: FloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
  })
  private cubeCamera = new CubeCamera(0.02, 80, this.cubeRT)
  private lampCubeRT = new WebGLCubeRenderTarget(LAMP_CUBE_SIZE, {
    type: FloatType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    generateMipmaps: false,
  })
  private lampCubeCamera = new CubeCamera(0.02, 80, this.lampCubeRT)
  private distanceMat = new ShaderMaterial({
    vertexShader: DISTANCE_VERTEX,
    fragmentShader: DISTANCE_FRAGMENT,
    uniforms: {
      uLightPos: { value: new Vector3() },
      uOutside: { value: 0 },
      uOutsideAt: { value: new Vector3() },
      uOutsideNormal: { value: new Vector3() },
    },
    side: DoubleSide,
  })
  private spotMat = additive(
    new ShaderMaterial({
      vertexShader: UV_SPACE_VERTEX,
      fragmentShader: SPOT_FRAGMENT,
      uniforms: {
        uNormalWorld: { value: new Matrix3() },
        uLightPos: { value: new Vector3() },
        uLightDir: { value: new Vector3() },
        uLightColor: { value: new Color() },
        uConeCos: { value: 0 },
        uPenumbraCos: { value: 0 },
        uDecay: { value: 2 },
        uCutoff: { value: 0 },
        uShadowMap: { value: null },
        uShadowMatrix: { value: null },
        uShadowCube: { value: null },
        uCubeShadow: { value: 0 },
        uCubeTexel: { value: Math.PI / 2 / LAMP_CUBE_SIZE },
        uLambert: { value: 0 },
        uOneSided: { value: 0 },
        uRoomCenter: { value: new Vector3() },
        uPortal: { value: 0 },
        uPortalCenter: { value: new Vector3() },
        uPortalU: { value: new Vector3() },
        uPortalV: { value: new Vector3() },
        uDirMode: { value: 0 },
        uShadowTexel: { value: new Vector2(1 / SHADOW_SIZE, 1 / SHADOW_SIZE) },
        uBias: { value: 0.02 },
        uWeight: { value: 1 },
        uAlphaMode: { value: 0 },
      },
    }),
  )
  private vplMat = additive(
    new ShaderMaterial({
      vertexShader: UV_SPACE_VERTEX,
      fragmentShader: VPL_FRAGMENT,
      uniforms: {
        uNormalWorld: { value: new Matrix3() },
        uVplPos: { value: new Vector3() },
        uVplNormal: { value: new Vector3() },
        uVplIntensity: { value: new Color() },
        uVplShadow: { value: null },
        uMinDist2: { value: VPL_MIN_DIST * VPL_MIN_DIST },
        uDirMode: { value: 0 },
        uBias: { value: 0.03 },
        uAlphaMode: { value: 0 },
      },
    }),
  )
  private geometryMat = new ShaderMaterial({
    vertexShader: UV_SPACE_VERTEX,
    fragmentShader: GEOMETRY_FRAGMENT,
    uniforms: { uNormalWorld: { value: new Matrix3() }, uWhat: { value: 0 } },
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  })
  private resolveMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: RESOLVE_FRAGMENT,
    uniforms: { uSource: { value: null }, uScale: { value: 1 } },
    depthTest: false,
    depthWrite: false,
  })
  private combineMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: COMBINE_FRAGMENT,
    uniforms: {
      uDirect: { value: null },
      uBounce: { value: null },
      uBounceTexel: { value: new Vector2() },
      uRadius: { value: 0 },
      uWrites: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
  })
  private dilateMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: DILATE_FRAGMENT,
    uniforms: { uSource: { value: null }, uTexel: { value: new Vector2() } },
    depthTest: false,
    depthWrite: false,
  })
  private outputs: WebGLRenderTarget[] = []
  private addMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: `uniform sampler2D uA; uniform sampler2D uB; varying vec2 vUv;
      void main() {
        vec4 a = texture2D(uA, vUv);
        gl_FragColor = vec4(a.rgb + texture2D(uB, vUv).rgb, a.a);
      }`,
    uniforms: { uA: { value: null }, uB: { value: null } },
    depthTest: false,
    depthWrite: false,
  })
  private dirOutputs: (WebGLRenderTarget | null)[] = []
  private directionMat = new ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: DIRECTION_FRAGMENT,
    uniforms: { uDirAccum: { value: null }, uDirect: { value: null }, uBounce: { value: null } },
    depthTest: false,
    depthWrite: false,
  })
  private emitters: AreaEmitter[] = []
  /** Flux re-emitted by each bounce source (luminance), for the ambient term. */
  private bounceFlux: number[] = []
  private roomCenter = new Vector3()
  readonly stats = { lamps: 0, casters: 0, vpls: 0, renders: 0, ms: 0, steps: 0 }

  constructor(renderer: WebGLRenderer, scene: Scene) {
    this.renderer = renderer
    this.scene = scene
    // Additive accumulation into float32 targets needs this; three does not request it.
    renderer.getContext().getExtension('EXT_float_blend')
    this.quad.frustumCulled = false
    this.quadScene.add(this.quad)
    this.cubeCamera.children.forEach((c) => c.layers.set(CASTER_LAYER))
    this.lampCubeCamera.children.forEach((c) => c.layers.set(CASTER_LAYER))
    this.shadowCamera.layers.set(CASTER_LAYER)
  }

  /** Gather receivers, lamps and casters from the live scene. */
  prepare(receivers: BakeReceiver[], emitters: AreaEmitter[] = [], roomCenter?: Vector3) {
    this.random = seededRandom(BAKE_SEED)
    this.scene.updateMatrixWorld(true)
    this.emitters = emitters
    if (roomCenter) this.roomCenter.copy(roomCenter)
    const receiverMeshes = new Set(receivers.map((r) => r.mesh))

    this.scene.traverse((object) => {
      const light = object as SpotLight
      if (light.isSpotLight && isWorldVisible(light) && light.intensity > 0) {
        const position = new Vector3().setFromMatrixPosition(light.matrixWorld)
        const target = new Vector3().setFromMatrixPosition(light.target.matrixWorld)
        this.lamps.push({
          position,
          direction: target.sub(position).normalize(),
          color: light.color.clone().multiplyScalar(light.intensity),
          coneCos: Math.cos(light.angle),
          penumbraCos: Math.cos(light.angle * (1 - light.penumbra)),
          decay: light.decay,
          cutoff: light.distance,
          angle: light.angle,
          // A 90° field is a diffused fixture (see lookSpot); anything narrower is a lensed head.
          aperture: light.angle >= Math.PI / 2 - 1e-3 ? DIFFUSER_APERTURE : LAMP_APERTURE,
          wide: light.angle >= Math.PI / 2 - 1e-3,
        })
      }
      const mesh = object as Mesh
      if (!mesh.isMesh || !isWorldVisible(mesh) || isLampPart(mesh)) return
      const material = mesh.material as Material & {
        isTroikaTextMaterial?: boolean
        isShaderMaterial?: boolean
      }
      if (!material || material.isTroikaTextMaterial) return
      // Click targets: the artwork hit-plane and similar hide their MATERIAL, not the mesh.
      if (!material.visible || material.colorWrite === false) return
      if (material.isShaderMaterial && material.transparent) return // fake shadow decals
      if (/glass/i.test(mesh.name)) return
      // A sky panel behind a window casts no shadow: the sky can't shade the sun.
      if (/^windowLight\d+$/.test(mesh.name)) return
      if (receiverMeshes.has(mesh) || mesh.geometry) {
        mesh.layers.enable(CASTER_LAYER)
        this.casters.push(mesh)
      }
    })

    this.receivers = receivers.map((r) => {
      const proxy = new Mesh(r.mesh.geometry, this.spotMat)
      // The LOCAL matrix must carry the transform: rendering updates world matrices from
      // local ones (the bake scene forces it every render), so setting only matrixWorld is
      // silently reset to identity — which baked every surface at its untransformed position.
      proxy.matrixAutoUpdate = false
      proxy.matrix.copy(r.mesh.matrixWorld)
      proxy.matrixWorld.copy(r.mesh.matrixWorld)
      proxy.frustumCulled = false
      // Half float (~3 significant digits) rounds away small additive contributions once a
      // texel is lit (~25% of the bounce light, measured): both accumulate in float32.
      const accum = new WebGLRenderTarget(r.size, r.size, {
        type: FloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
      })
      // Bounce at full resolution on every receiver (a 1 cm switch rim has no half-resolution
      // texel of its own), with exact write counts in alpha for the chart-edge normalization
      // (half float stops counting at 2048).
      const bounceSize = r.size
      const accumBounce = new WebGLRenderTarget(bounceSize, bounceSize, {
        type: FloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
      })
      const grid = Array.from(
        { length: VPL_BOUNCES + 1 },
        () => new WebGLRenderTarget(GRID, GRID, { type: FloatType, format: RGBAFormat }),
      )
      return {
        ...r,
        proxy,
        accum,
        accumBounce,
        grid,
        position: new Float32Array(GRID * GRID * 4),
        normal: new Float32Array(GRID * GRID * 4),
        texelArea: 0,
        bounceSize,
        dirAccum: r.directional
          ? new WebGLRenderTarget(r.size, r.size, {
              type: FloatType,
              minFilter: LinearFilter,
              magFilter: LinearFilter,
            })
          : null,
        normalWorld: new Matrix3().getNormalMatrix(r.mesh.matrixWorld),
      }
    })

    this.stats.lamps = this.lamps.length
    ;(this.stats as unknown as { bounds: string[] }).bounds = receivers.map((r) => {
      r.mesh.geometry.computeBoundingBox()
      const box = r.mesh.geometry.boundingBox!.clone().applyMatrix4(r.mesh.matrixWorld)
      return `${r.name} y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)} x ${box.min.x.toFixed(1)}..${box.max.x.toFixed(1)} z ${box.min.z.toFixed(1)}..${box.max.z.toFixed(1)}`
    })
    ;(this.stats as unknown as { lampPositions: string[] }).lampPositions = this.lamps.map(
      (l) =>
        `${l.position.x.toFixed(2)},${l.position.y.toFixed(2)},${l.position.z.toFixed(2)} I=${(
          l.color.r * 0.2126 +
          l.color.g * 0.7152 +
          l.color.b * 0.0722
        ).toFixed(1)}`,
    )
    this.stats.casters = this.casters.length
  }

  /**
   * Re-rates mounted lamps after `prepare` — per-zone lighting design (a corridor keeps standard
   * fixtures). `rate` returns the lamp's new luminous intensity, or null.
   */
  rateLamps(
    rate: (lamp: { position: Vector3; wide: boolean; intensity: number }) => number | null,
  ) {
    for (const l of this.lamps) {
      const lum = l.color.r * 0.2126 + l.color.g * 0.7152 + l.color.b * 0.0722
      const target = rate({ position: l.position, wide: l.wide, intensity: lum })
      if (target !== null && lum > 0) l.color.multiplyScalar(target / lum)
    }
  }

  /**
   * The sun — parallel light (no falloff) travelling along `direction`, aimed through `through`
   * (a window), with the sun's 0.27° disc as its soft-shadow aperture. Only the room side of each
   * surface receives it (see `oneSided`), and with a `portal` only what it reaches through that
   * window's glass.
   */
  addSun(
    direction: Vector3,
    illuminance: Color,
    through: Vector3,
    reach: number,
    portal?: Lamp['portal'],
  ) {
    const distance = 60
    const dir = direction.clone().normalize()
    const angle = Math.atan(reach / distance)
    this.lamps.push({
      position: through.clone().addScaledVector(dir, -distance),
      direction: dir,
      color: illuminance.clone(),
      coneCos: Math.cos(angle),
      penumbraCos: Math.cos(angle * 0.95),
      decay: 0,
      cutoff: 0,
      angle,
      aperture: distance * Math.tan((0.27 * Math.PI) / 180),
      wide: false,
      oneSided: true,
      portal,
    })
    this.stats.lamps = this.lamps.length
  }

  private clear(target: WebGLRenderTarget) {
    this.renderer.setRenderTarget(target)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear(true, true, false)
  }

  private renderReceiver(r: ReceiverState, material: ShaderMaterial, target: WebGLRenderTarget) {
    material.uniforms.uNormalWorld.value = r.normalWorld
    r.proxy.material = material
    this.bakeScene.add(r.proxy)
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.bakeScene, this.dummyCamera)
    this.bakeScene.remove(r.proxy)
    this.stats.renders++
  }

  /**
   * The baking work, as a generator so the caller can spread it across frames. It yields
   * `totalSteps()` times (`stats.steps` counts them).
   */
  *run(): Generator<void, void, void> {
    this.stats.steps = 0
    for (const step of this.runSteps()) {
      this.stats.steps++
      yield step
    }
  }

  /**
   * How many times `run()` will yield, for the prepared bake — a loader's `done / total`.
   * The bounce passes assume each draws its full `VPL_COUNT` lights (they do unless a bounce
   * has no lit surface to sample); everything else is fixed by the prepared scene.
   */
  totalSteps(): number {
    const receivers = this.receivers.length
    let steps = 1 // geometry maps
    steps += this.lamps.length * LAMP_JITTER // 1. direct light
    steps += this.emitterTris().vpls // 1b. daylight
    steps += VPL_BOUNCES * VPL_COUNT // 2. bounces
    steps += 1 + receivers // 4. near field: room build, chart sides
    steps += Math.max(1, Math.round(NEAR_SPP / RAYS_PER_PASS)) * receivers
    return steps
  }

  private *runSteps(): Generator<void, void, void> {
    const t0 = performance.now()
    const renderer = this.renderer
    const savedAutoClear = renderer.autoClear
    const savedBackground = this.scene.background
    const savedOverride = this.scene.overrideMaterial
    const savedClear = new Color()
    renderer.getClearColor(savedClear)
    const savedClearAlpha = renderer.getClearAlpha()

    const begin = () => {
      renderer.autoClear = false
      this.scene.background = null
    }
    const end = () => {
      renderer.autoClear = savedAutoClear
      this.scene.background = savedBackground
      this.scene.overrideMaterial = savedOverride
      renderer.setClearColor(savedClear, savedClearAlpha)
      renderer.setRenderTarget(null)
    }

    // --- geometry maps for the bounce emitters ------------------------------------------
    begin()
    const geomRT = new WebGLRenderTarget(GRID, GRID, { type: FloatType })
    for (const r of this.receivers) {
      this.clear(r.accum)
      this.clear(r.accumBounce)
      if (r.dirAccum) this.clear(r.dirAccum)
      r.grid.forEach((g) => this.clear(g))
      for (const [what, buffer] of [
        [0, r.position],
        [1, r.normal],
      ] as const) {
        this.clear(geomRT)
        this.geometryMat.uniforms.uWhat.value = what
        this.renderReceiver(r, this.geometryMat, geomRT)
        renderer.readRenderTargetPixels(geomRT, 0, 0, GRID, GRID, buffer)
      }
      let covered = 0
      for (let i = 3; i < r.position.length; i += 4) if (r.position[i]! > 0) covered++
      r.texelArea = covered > 0 ? worldArea(r.mesh.geometry, r.mesh) / covered : 0
    }
    geomRT.dispose()
    end()
    yield

    // --- 1. direct light from the real lamps, with shadows ------------------------------
    const s = this.spotMat.uniforms
    const v = this.vplMat.uniforms
    for (const lamp of this.lamps) {
      for (let j = 0; j < LAMP_JITTER; j++) {
        begin()
        // The LED's emitting surface: a small disc facing the aim direction, just in front of
        // the fixture. (A sphere put half the samples BEHIND the fixture — for recessed lamps
        // flush with the ceiling, above the ceiling, which then shadowed the whole room.)
        const tangent = new Vector3(0, 1, 0).cross(lamp.direction)
        if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0)
        tangent.normalize()
        const bitangent = lamp.direction.clone().cross(tangent).normalize()
        const radius = lamp.aperture * Math.sqrt(this.random())
        const theta = this.random() * Math.PI * 2
        const position = lamp.position
          .clone()
          .addScaledVector(lamp.direction, LAMP_FRONT_OFFSET)
          .addScaledVector(tangent, Math.cos(theta) * radius)
          .addScaledVector(bitangent, Math.sin(theta) * radius)

        // Shadow map from the lamp: inverse distance of the nearest caster. Wide diffusers
        // get a cube (even texels in every direction); lensed heads a perspective map.
        const d = this.distanceMat.uniforms
        d.uLightPos.value.copy(position)
        d.uOutside.value = lamp.portal ? 1 : 0
        if (lamp.portal) {
          // Outdoors starts past the window wall's own depth (its reveal still shades the sun).
          const outward = lamp.portal.u.clone().cross(lamp.portal.v).normalize()
          if (outward.dot(lamp.direction) > 0) outward.negate()
          d.uOutsideNormal.value.copy(outward)
          d.uOutsideAt.value.copy(lamp.portal.center).addScaledVector(outward, PORTAL_WALL_DEPTH)
        }
        if (lamp.wide) {
          this.lampCubeCamera.position.copy(position)
          this.scene.overrideMaterial = this.distanceMat
          renderer.setClearColor(0x000000, 0)
          renderer.autoClear = true
          this.lampCubeCamera.update(renderer, this.scene)
          renderer.autoClear = false
          this.scene.overrideMaterial = savedOverride
          this.stats.renders += 6
        } else {
          this.shadowCamera.fov = Math.min(170, ((lamp.angle * 2) / Math.PI) * 180 + 10)
          this.shadowCamera.position.copy(position)
          this.shadowCamera.lookAt(position.clone().add(lamp.direction))
          this.shadowCamera.updateProjectionMatrix()
          this.shadowCamera.updateMatrixWorld()
          this.scene.overrideMaterial = this.distanceMat
          this.clear(this.shadowRT)
          renderer.setRenderTarget(this.shadowRT)
          renderer.render(this.scene, this.shadowCamera)
          this.scene.overrideMaterial = savedOverride
          this.stats.renders++
        }
        // The VPL passes share this material: indoors only for the sun's own shadow map.
        d.uOutside.value = 0
        s.uCubeShadow.value = lamp.wide ? 1 : 0
        s.uLambert.value = lamp.wide ? 1 : 0
        s.uOneSided.value = lamp.oneSided ? 1 : 0
        s.uRoomCenter.value.copy(this.roomCenter)
        s.uPortal.value = lamp.portal ? 1 : 0
        if (lamp.portal) {
          s.uPortalCenter.value.copy(lamp.portal.center)
          s.uPortalU.value.copy(lamp.portal.u)
          s.uPortalV.value.copy(lamp.portal.v)
        }
        s.uShadowCube.value = this.lampCubeRT.texture

        s.uLightPos.value.copy(position)
        s.uLightDir.value.copy(lamp.direction)
        s.uLightColor.value.copy(lamp.color)
        s.uConeCos.value = lamp.coneCos
        s.uPenumbraCos.value = lamp.penumbraCos
        s.uDecay.value = lamp.decay
        s.uCutoff.value = lamp.cutoff
        s.uShadowMap.value = this.shadowRT.texture
        s.uShadowMatrix.value = this.shadowCamera.projectionMatrix
          .clone()
          .multiply(this.shadowCamera.matrixWorldInverse)
        s.uWeight.value = 1 / LAMP_JITTER
        for (const r of this.receivers) {
          if (r.noLampDirect) continue
          s.uAlphaMode.value = 0
          this.renderReceiver(r, this.spotMat, r.accum)
          s.uAlphaMode.value = 1
          this.renderReceiver(r, this.spotMat, r.grid[0]!)
          if (r.dirAccum) {
            s.uDirMode.value = 1
            this.renderReceiver(r, this.spotMat, r.dirAccum)
            s.uDirMode.value = 0
          }
        }
        end()
        yield
      }
    }

    // --- 1b. daylight: window glass as area emitters (into the room, with shadows) -------
    for (const vpl of this.sampleEmitters()) {
      begin()
      this.renderVplShadow(vpl.position, savedOverride)
      v.uVplPos.value.copy(vpl.position)
      v.uVplNormal.value.copy(vpl.normal)
      v.uVplIntensity.value.copy(vpl.intensity)
      v.uVplShadow.value = this.cubeRT.texture
      for (const r of this.receivers) {
        v.uAlphaMode.value = 0
        this.renderReceiver(r, this.vplMat, r.accumBounce)
        v.uAlphaMode.value = 1
        this.renderReceiver(r, this.vplMat, r.grid[0]!)
        // Daylight rakes across walls and ceiling near the window: it has a direction too.
        if (r.dirAccum) {
          v.uDirMode.value = 1
          this.renderReceiver(r, this.vplMat, r.dirAccum)
          v.uDirMode.value = 0
        }
      }
      end()
      yield
    }

    // --- 2. bounces: instant radiosity --------------------------------------------------
    for (let bounce = 0; bounce < VPL_BOUNCES; bounce++) {
      const vpls = this.sampleVpls(bounce)
      this.stats.vpls += vpls.length
      // The bounces not simulated, as the classic radiosity ambient term: each bounce re-emits
      // a fraction r of the previous one, so everything after the last is that bounce ×
      // r/(1 − r). r is measured from the bake's own last two bounces. In a white room
      // (r ≈ 0.6) stopping at three bounces otherwise loses ~20% of the indirect light.
      if (bounce === VPL_BOUNCES - 1 && bounce > 0) {
        const r = Math.min(0.9, this.bounceFlux[bounce]! / this.bounceFlux[bounce - 1]!)
        if (r > 0) {
          const tail = 1 / (1 - r)
          vpls.forEach((vpl) => vpl.intensity.multiplyScalar(tail))
          ;(this.stats as unknown as { tail: number }).tail = +tail.toFixed(3)
        }
      }
      for (const vpl of vpls) {
        begin()
        this.renderVplShadow(vpl.position, savedOverride)

        v.uVplPos.value.copy(vpl.position)
        v.uVplNormal.value.copy(vpl.normal)
        v.uVplIntensity.value.copy(vpl.intensity)
        v.uVplShadow.value = this.cubeRT.texture
        for (const r of this.receivers) {
          v.uAlphaMode.value = 0
          this.renderReceiver(r, this.vplMat, r.accumBounce)
          v.uAlphaMode.value = 1
          this.renderReceiver(r, this.vplMat, r.grid[bounce + 1]!)
        }
        end()
        yield
      }
    }

    // --- 3. resolve + dilate into the final lightmaps -----------------------------------
    begin()
    for (const r of this.receivers) {
      this.outputs.push(this.compose(r, r.accumBounce.texture, r.bounceSize))
      this.dirOutputs.push(r.dirAccum ? this.resolveDirection(r) : null)
    }
    end()

    // --- 4. near field: add back what the bounce lights' clamp dropped near surfaces --------
    yield* this.nearField(begin, end)

    // Casters back to normal.
    this.casters.forEach((m) => m.layers.disable(CASTER_LAYER))
    this.stats.ms = Math.round(performance.now() - t0)
  }

  /** Direct + bounce → one lightmap, dilated so bilinear sampling never reads black seams. */
  private compose(r: ReceiverState, bounce: Texture, bounceSize: number): WebGLRenderTarget {
    const renderer = this.renderer
    const a = new WebGLRenderTarget(r.size, r.size, { type: HalfFloatType })
    const b = new WebGLRenderTarget(r.size, r.size, { type: HalfFloatType })
    const u = this.combineMat.uniforms
    this.quad.material = this.combineMat
    u.uDirect.value = r.accum.texture
    u.uBounce.value = bounce
    u.uBounceTexel.value.set(1 / bounceSize, 1 / bounceSize)
    u.uRadius.value = r.smoothBounce ? 1.5 : 0
    // The bounce's write-count alpha normalizes the chart-edge taps.
    u.uWrites.value = Math.max(1, this.stats.vpls)
    this.clear(a)
    renderer.render(this.quadScene, this.quadCamera)
    let src = a
    let dst = b
    this.quad.material = this.dilateMat
    this.dilateMat.uniforms.uTexel.value.set(1 / r.size, 1 / r.size)
    for (let i = 0; i < 8; i++) {
      this.dilateMat.uniforms.uSource.value = src.texture
      this.clear(dst)
      renderer.render(this.quadScene, this.quadCamera)
      ;[src, dst] = [dst, src]
    }
    dst.dispose()
    return src
  }

  /**
   * The room as ray-traceable triangles: receivers a ray reads the light of (their lightmap
   * slot), everything else as a constant, window glass as emitters. (Artworks lack the lamps'
   * direct light in theirs, so a ray sees them as a constant instead.)
   */
  private buildRoom() {
    const sampled = this.receivers.filter((r) => !r.noLampDirect).slice(0, 6)
    const ambient = this.percentileIrradiance('wall', 0.5)
    const sources: GatherSource[] = []
    sampled.forEach((r, slot) =>
      sources.push({
        geometry: r.mesh.geometry,
        matrixWorld: r.proxy.matrixWorld,
        kind: TriangleKind.Receiver,
        slot,
        color: r.albedo,
      }),
    )
    const represented = new Set<Object3D>()
    for (const r of this.receivers) {
      ;(r.sources ?? [r.mesh]).forEach((m) => represented.add(m))
      if (!sampled.includes(r))
        sources.push({
          geometry: r.mesh.geometry,
          matrixWorld: r.proxy.matrixWorld,
          kind: TriangleKind.Constant,
          color: r.albedo.clone().multiplyScalar(ambient / Math.PI),
        })
    }
    for (const mesh of this.casters) {
      if (represented.has(mesh)) continue
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as
        | (Material & { color?: Color; map?: Texture | null })
        | undefined
      const albedo = material?.color ? material.color.clone() : new Color(0.5, 0.5, 0.5)
      if (material?.map) albedo.multiplyScalar(0.6)
      albedo.setRGB(Math.min(albedo.r, 0.9), Math.min(albedo.g, 0.9), Math.min(albedo.b, 0.9))
      sources.push({
        geometry: mesh.geometry,
        matrixWorld: mesh.matrixWorld,
        kind: TriangleKind.Constant,
        color: albedo.multiplyScalar(ambient / Math.PI),
        coverage: material?.transparent ? material.opacity : 1,
      })
    }
    for (const e of this.emitters) {
      e.mesh.updateMatrixWorld(true)
      sources.push({
        geometry: e.mesh.geometry,
        matrixWorld: e.mesh.matrixWorld,
        kind: TriangleKind.Emitter,
        color: e.radiance,
      })
    }
    return { room: buildGatherScene(sources), sampled }
  }

  /** `uLM0…uLM5`: the current lightmaps of the receivers a ray can read. */
  private lightmapUniforms(sampled: ReceiverState[]) {
    return Object.fromEntries(
      [0, 1, 2, 3, 4, 5].map((k) => [
        `uLM${k}`,
        { value: sampled[k] ? this.outputs[this.receivers.indexOf(sampled[k])]!.texture : null },
      ]),
    )
  }

  /**
   * Which side of each chart faces the room: ±1 per chart id, voted at up to 1024² — every
   * texel's front-minus-back ray distance, summed per chart. (Voted per texel, texels beside a
   * frame — rays stopped by it within cm — flipped and traced from behind the wall.)
   */
  private chartSides(r: ReceiverState, sideMat: ShaderMaterial): Map<number, number> {
    const renderer = this.renderer
    const size = Math.min(r.size, 1024)
    const options = { type: FloatType, minFilter: NearestFilter, magFilter: NearestFilter }
    const scoreRT = new WebGLRenderTarget(size, size, options)
    const chartRT = new WebGLRenderTarget(size, size, options)
    const chartMat = new ShaderMaterial({
      vertexShader: CHART_VERTEX,
      fragmentShader: CHART_FRAGMENT,
      uniforms: { uNormalWorld: { value: new Matrix3() } },
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    })
    this.clear(scoreRT)
    this.renderReceiver(r, sideMat, scoreRT)
    const scores = new Float32Array(size * size * 4)
    renderer.readRenderTargetPixels(scoreRT, 0, 0, size, size, scores)
    this.clear(chartRT)
    this.renderReceiver(r, chartMat, chartRT)
    const charts = new Float32Array(size * size * 4)
    renderer.readRenderTargetPixels(chartRT, 0, 0, size, size, charts)
    const votes = new Map<number, number>()
    for (let t = 0; t < size * size; t++) {
      if (scores[t * 4 + 3]! <= 0) continue
      const id = Math.round(charts[t * 4]!)
      votes.set(id, (votes.get(id) ?? 0) + scores[t * 4]!)
    }
    scoreRT.dispose()
    chartRT.dispose()
    chartMat.dispose()
    return new Map([...votes].map(([id, vote]) => [id, vote < 0 ? -1 : 1]))
  }

  /**
   * Near-field compensation. Each bounce light's d² is clamped at
   * VPL_MIN_DIST (else a light 1 cm away is a firefly), so any surface within that distance of
   * another — every inside corner — loses the light the two exchange: measured on Madrid's
   * ceiling, −58% at the wall where the truth is ≈ −30%. That loss is exactly
   * ∫ L(y)·cosθ·(1 − d²/r²) dω over what lies within r (Kollig & Keller's bias compensation):
   * every texel traces cosine rays no further than r and adds what they hit, weighted so. Rays
   * that travel further add nothing, so the rest of the room is the VPL solution untouched.
   * L(y) is the hit's albedo × its baked light / π (or the window's daylight); frames were
   * never bounce sources in the VPL solution, so they only block here (display panels are
   * receivers since AR-163, read like the walls).
   */
  private *nearField(begin: () => void, end: () => void): Generator<void, void, void> {
    const renderer = this.renderer
    const t0 = performance.now()
    begin()
    const { room, sampled } = this.buildRoom()
    const shared = {
      uTris: { value: room.triangles },
      uNodes: { value: room.nodes },
      uOffset: { value: 0.002 },
      uMaxDist: { value: 1e30 },
      ...this.lightmapUniforms(sampled),
    }
    const sideMat = new ShaderMaterial({
      vertexShader: UV_SPACE_VERTEX,
      fragmentShader: GATHER_SIDE_FRAGMENT,
      uniforms: { uNormalWorld: { value: new Matrix3() }, ...shared },
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    })
    end()
    yield
    // Each chart's room side, as a vertex attribute (a uniform for receivers with no charts).
    const sides: number[] = []
    for (const r of this.receivers) {
      begin()
      const votes = this.chartSides(r, sideMat)
      const chart = r.mesh.geometry.getAttribute('chart')
      if (chart) {
        const side = new Float32Array(chart.count)
        for (let i = 0; i < chart.count; i++) side[i] = votes.get(Math.round(chart.getX(i))) ?? 1
        r.mesh.geometry.setAttribute('chartSide', new BufferAttribute(side, 1))
        sides.push(0)
      } else sides.push(votes.get(0) ?? 1)
      end()
      yield
    }
    sideMat.dispose()

    const material = additive(
      new ShaderMaterial({
        vertexShader: NEAR_VERTEX,
        fragmentShader: NEAR_FRAGMENT,
        uniforms: {
          uNormalWorld: { value: new Matrix3() },
          ...shared,
          uMaxDist: { value: VPL_MIN_DIST },
          uSide: { value: 1 },
          uPass: { value: 0 },
          uRaysPerPass: { value: RAYS_PER_PASS },
          uTotalRays: { value: NEAR_SPP },
        },
      }),
    )
    // Receivers without charts (the floor) read `uSide`: their missing attribute must read 0.
    const defaults = material as unknown as { defaultAttributeValues: Record<string, number[]> }
    defaults.defaultAttributeValues = { ...defaults.defaultAttributeValues, chartSide: [0] }
    const targets = this.receivers.map(
      (r) => new WebGLRenderTarget(r.size, r.size, { type: FloatType }),
    )
    targets.forEach((t) => this.clear(t))
    const sync = new Float32Array(4)
    const passes = Math.max(1, Math.round(NEAR_SPP / RAYS_PER_PASS))
    material.uniforms.uTotalRays.value = passes * RAYS_PER_PASS
    for (let pass = 0; pass < passes; pass++) {
      for (const [i, r] of this.receivers.entries()) {
        begin()
        material.uniforms.uPass.value = pass
        material.uniforms.uSide.value = sides[i]
        this.renderReceiver(r, material, targets[i]!)
        renderer.readRenderTargetPixels(targets[i]!, 0, 0, 1, 1, sync)
        end()
        yield
      }
    }

    // Dilate the compensation like the light (so the two agree past every chart edge), add it.
    begin()
    this.receivers.forEach((r, i) => {
      let src = targets[i]!
      let dst = new WebGLRenderTarget(r.size, r.size, { type: HalfFloatType })
      this.quad.material = this.dilateMat
      this.dilateMat.uniforms.uTexel.value.set(1 / r.size, 1 / r.size)
      for (let k = 0; k < 8; k++) {
        this.dilateMat.uniforms.uSource.value = src.texture
        this.clear(dst)
        renderer.render(this.quadScene, this.quadCamera)
        ;[src, dst] = [dst, src]
      }
      const sum = new WebGLRenderTarget(r.size, r.size, { type: HalfFloatType })
      this.addMat.uniforms.uA.value = this.outputs[i]!.texture
      this.addMat.uniforms.uB.value = src.texture
      this.quad.material = this.addMat
      this.clear(sum)
      renderer.setRenderTarget(sum)
      renderer.render(this.quadScene, this.quadCamera)
      src.dispose()
      dst.dispose()
      this.outputs[i]!.dispose()
      this.outputs[i] = sum
      r.mesh.geometry.deleteAttribute('chartSide')
    })
    end()
    material.dispose()
    room.triangles.dispose()
    room.nodes.dispose()
    ;(this.stats as unknown as { nearField: Record<string, number> }).nearField = {
      spp: passes * RAYS_PER_PASS,
      radius: VPL_MIN_DIST,
      ms: Math.round(performance.now() - t0),
    }
  }

  /** Cube distance map from a point emitter, for its shadows. */
  private renderVplShadow(position: Vector3, savedOverride: Material | null) {
    const renderer = this.renderer
    this.cubeCamera.position.copy(position)
    this.distanceMat.uniforms.uLightPos.value.copy(position)
    this.scene.overrideMaterial = this.distanceMat
    renderer.setClearColor(0x000000, 0)
    renderer.autoClear = true
    this.cubeCamera.update(renderer, this.scene)
    renderer.autoClear = false
    this.scene.overrideMaterial = savedOverride
    this.stats.renders += 6
  }

  /**
   * Window glass → point emitters. A Lambertian surface of radiance L and area A emits flux
   * πLA, i.e. radiant intensity L·A along its normal; split evenly across its samples. The
   * normal is turned to face the room (glass planes are single-sided either way round).
   */
  private emitterTris() {
    type Tri = { a: Vector3; b: Vector3; c: Vector3; area: number; normal: Vector3; e: AreaEmitter }
    const tris: Tri[] = []
    for (const e of this.emitters) {
      e.mesh.updateMatrixWorld(true)
      const pos = e.mesh.geometry.getAttribute('position')
      const index = e.mesh.geometry.getIndex()
      const count = index ? index.count : pos.count
      for (let i = 0; i < count; i += 3) {
        const [a, b, c] = [0, 1, 2].map((k) =>
          new Vector3()
            .fromBufferAttribute(pos, index ? index.getX(i + k) : i + k)
            .applyMatrix4(e.mesh.matrixWorld),
        ) as [Vector3, Vector3, Vector3]
        const cross = b.clone().sub(a).cross(c.clone().sub(a))
        const area = cross.length() / 2
        if (area <= 0) continue
        const normal = cross.normalize()
        if (normal.dot(this.roomCenter.clone().sub(a)) < 0) normal.negate()
        tris.push({ a, b, c, area, normal, e })
      }
    }
    const lum = (c: Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
    const total = tris.reduce((sum, t) => sum + t.area * lum(t.e.radiance), 0)
    const counts =
      total > 0
        ? tris.map((t) =>
            Math.max(1, Math.round((EMITTER_VPLS * t.area * lum(t.e.radiance)) / total)),
          )
        : []
    return { tris, counts, total, vpls: counts.reduce((sum, n) => sum + n, 0) }
  }

  private sampleEmitters() {
    const { tris, counts, total } = this.emitterTris()
    if (total <= 0) return []
    const vpls: { position: Vector3; normal: Vector3; intensity: Color }[] = []
    for (const [index, t] of tris.entries()) {
      const n = counts[index]!
      for (let k = 0; k < n; k++) {
        let u = this.random()
        let w = this.random()
        if (u + w > 1) {
          u = 1 - u
          w = 1 - w
        }
        const position = t.a
          .clone()
          .addScaledVector(t.b.clone().sub(t.a), u)
          .addScaledVector(t.c.clone().sub(t.a), w)
          .addScaledVector(t.normal, 0.02)
        vpls.push({
          position,
          normal: t.normal,
          intensity: t.e.radiance.clone().multiplyScalar(t.area / n),
        })
      }
    }
    this.stats.vpls += vpls.length
    return vpls
  }

  /** Importance-sample lit surface patches (radiosity × area) as bounce emitters. */
  private sampleVpls(bounce: number) {
    type Candidate = { r: ReceiverState; i: number; weight: number; flux: Color; sign: number }
    const candidates: Candidate[] = []
    let total = 0
    for (const r of this.receivers) {
      if (r.noEmit) continue
      const irradiance = new Float32Array(GRID * GRID * 4)
      this.renderer.readRenderTargetPixels(r.grid[bounce]!, 0, 0, GRID, GRID, irradiance)
      for (let t = 0; t < GRID * GRID; t++) {
        if (r.position[t * 4 + 3]! <= 0) continue
        const flux = new Color(
          irradiance[t * 4]! * r.albedo.r,
          irradiance[t * 4 + 1]! * r.albedo.g,
          irradiance[t * 4 + 2]! * r.albedo.b,
        ).multiplyScalar(r.texelArea)
        const weight = flux.r * 0.2126 + flux.g * 0.7152 + flux.b * 0.0722
        if (weight <= 0) continue
        candidates.push({ r, i: t, weight, flux, sign: Math.sign(irradiance[t * 4 + 3]!) || 1 })
        total += weight
      }
    }
    // Energy diagnostics: mean irradiance of this bounce's source over each receiver.
    const energy = this.receivers.map((r) => {
      const irradiance = new Float32Array(GRID * GRID * 4)
      this.renderer.readRenderTargetPixels(r.grid[bounce]!, 0, 0, GRID, GRID, irradiance)
      let sum = 0
      let n = 0
      let max = 0
      for (let t = 0; t < GRID * GRID; t++) {
        if (r.position[t * 4 + 3]! <= 0) continue
        const lum =
          irradiance[t * 4]! * 0.2126 +
          irradiance[t * 4 + 1]! * 0.7152 +
          irradiance[t * 4 + 2]! * 0.0722
        sum += lum
        max = Math.max(max, lum)
        n++
      }
      return `${r.name}: mean ${(sum / Math.max(n, 1)).toFixed(3)} max ${max.toFixed(1)}`
    })
    ;((this.stats as unknown as { energy: string[] }).energy ??= []).push(
      `bounce-source ${bounce}: total flux ${total.toFixed(2)} | ${energy.join(' | ')}`,
    )
    this.bounceFlux[bounce] = total
    if (total <= 0 || candidates.length === 0) return []

    // Stratified sampling over the CDF.
    const vpls: { position: Vector3; normal: Vector3; intensity: Color }[] = []
    let acc = 0
    let k = 0
    const step = total / VPL_COUNT
    let next = this.random() * step
    for (const c of candidates) {
      acc += c.weight
      while (acc >= next && k < VPL_COUNT) {
        const p = c.i * 4
        const normal = new Vector3(c.r.normal[p], c.r.normal[p + 1], c.r.normal[p + 2])
          .normalize()
          .multiplyScalar(c.sign)
        const position = new Vector3(
          c.r.position[p],
          c.r.position[p + 1],
          c.r.position[p + 2],
        ).addScaledVector(normal, 0.02)
        // Texel centers form a regular grid: near a corner its row of bounce lights showed as a
        // row of spots on the adjacent wall. Place each one randomly within its texel.
        const size = Math.sqrt(c.r.texelArea) * 0.8
        const tangent = new Vector3(0, 1, 0).cross(normal)
        if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0)
        tangent.normalize()
        const bitangent = normal.clone().cross(tangent)
        position
          .addScaledVector(tangent, (this.random() - 0.5) * size)
          .addScaledVector(bitangent, (this.random() - 0.5) * size)
        // Each VPL carries flux × total/(weight × N); radiant intensity = Φ/π.
        const intensity = c.flux.clone().multiplyScalar(total / (c.weight * VPL_COUNT) / Math.PI)
        vpls.push({ position, normal, intensity })
        k++
        next += step
      }
    }
    return vpls
  }

  /**
   * Debug: each receiver's final lightmap as a PNG data URL (Reinhard-mapped), plus coverage
   * and mean/max irradiance over covered texels, and its UV bounds.
   */
  debugDump(size = 512) {
    const rt = new WebGLRenderTarget(size, size, { type: FloatType })
    const copy = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: `uniform sampler2D uSource; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSource, vUv); }`,
      uniforms: { uSource: { value: null } },
      depthTest: false,
      depthWrite: false,
    })
    const result = this.receivers.map((r, index) => {
      copy.uniforms.uSource.value = this.outputs[index]?.texture ?? null
      this.quad.material = copy
      this.clear(rt)
      this.renderer.render(this.quadScene, this.quadCamera)
      const px = new Float32Array(size * size * 4)
      this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, px)
      let covered = 0
      let sum = 0
      let max = 0
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(size, size)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4
          const lum = px[i]! * 0.2126 + px[i + 1]! * 0.7152 + px[i + 2]! * 0.0722
          if (px[i + 3]! > 0) {
            covered++
            sum += lum
            max = Math.max(max, lum)
          }
          const o = ((size - 1 - y) * size + x) * 4
          for (let k = 0; k < 3; k++) {
            const v = px[i + k]! / 2
            img.data[o + k] = Math.round(255 * Math.pow(v / (1 + v), 1 / 2.2))
          }
          img.data[o + 3] = px[i + 3]! > 0 ? 255 : 60
        }
      }
      ctx.putImageData(img, 0, 0)
      const uv = r.mesh.geometry.getAttribute('uv')
      let uMin = Infinity,
        uMax = -Infinity,
        vMin = Infinity,
        vMax = -Infinity
      for (let i = 0; i < uv.count; i++) {
        uMin = Math.min(uMin, uv.getX(i))
        uMax = Math.max(uMax, uv.getX(i))
        vMin = Math.min(vMin, uv.getY(i))
        vMax = Math.max(vMax, uv.getY(i))
      }
      // UV overlap check: total UV triangle area vs. the texels actually covered.
      let uvArea = 0
      const tris = r.mesh.geometry.getIndex()
      const triCount = (tris ? tris.count : uv.count) / 3
      for (let t = 0; t < triCount; t++) {
        const ia = tris ? tris.getX(t * 3) : t * 3
        const ib = tris ? tris.getX(t * 3 + 1) : t * 3 + 1
        const ic = tris ? tris.getX(t * 3 + 2) : t * 3 + 2
        const ax = uv.getX(ia),
          ay = uv.getY(ia)
        uvArea +=
          Math.abs(
            (uv.getX(ib) - ax) * (uv.getY(ic) - ay) - (uv.getX(ic) - ax) * (uv.getY(ib) - ay),
          ) / 2
      }
      return {
        name: r.name,
        uvAreaSum: +uvArea.toFixed(3),
        coverage: covered / (size * size),
        mean: covered ? sum / covered : 0,
        max,
        texelArea: r.texelArea,
        uv: [uMin, uMax, vMin, vMax].map((n) => +n.toFixed(3)),
        png: canvas.toDataURL('image/png'),
      }
    })
    rt.dispose()
    copy.dispose()
    this.renderer.setRenderTarget(null)
    return result
  }

  /**
   * Metering: the irradiance that a given fraction of a receiver's texels stay below (summed
   * over direct + every bounce, or the bounces alone), from the bake's own grids — e.g. 0.97 ≈
   * the lit pools.
   */
  percentileIrradiance(name: string, fraction: number, bounceOnly = false): number {
    const r = this.receivers.find((x) => x.name === name)
    if (!r) return 0
    const total = new Float32Array(GRID * GRID)
    const buffer = new Float32Array(GRID * GRID * 4)
    // grid[0] is direct light (lamps, the sun, daylight); the rest are bounces.
    for (const g of bounceOnly ? r.grid.slice(1) : r.grid) {
      this.renderer.readRenderTargetPixels(g, 0, 0, GRID, GRID, buffer)
      for (let t = 0; t < GRID * GRID; t++) {
        total[t]! +=
          buffer[t * 4]! * 0.2126 + buffer[t * 4 + 1]! * 0.7152 + buffer[t * 4 + 2]! * 0.0722
      }
    }
    const values: number[] = []
    for (let t = 0; t < GRID * GRID; t++) if (r.position[t * 4 + 3]! > 0) values.push(total[t]!)
    if (!values.length) return 0
    values.sort((a, b) => a - b)
    return values[Math.min(values.length - 1, Math.floor(values.length * fraction))]!
  }

  /**
   * Colour of a receiver's bounce light: mean RGB over its texels, scaled to the median bounce
   * irradiance — what the room reflects back onto anything hung on that surface.
   */
  bounceColor(name: string): Color {
    const r = this.receivers.find((x) => x.name === name)
    const sum = new Color(0, 0, 0)
    if (!r) return sum
    const buffer = new Float32Array(GRID * GRID * 4)
    for (const g of r.grid.slice(1)) {
      this.renderer.readRenderTargetPixels(g, 0, 0, GRID, GRID, buffer)
      for (let t = 0; t < GRID * GRID; t++) {
        if (r.position[t * 4 + 3]! <= 0) continue
        sum.r += buffer[t * 4]!
        sum.g += buffer[t * 4 + 1]!
        sum.b += buffer[t * 4 + 2]!
      }
    }
    const lum = sum.r * 0.2126 + sum.g * 0.7152 + sum.b * 0.0722
    if (lum <= 0) return sum
    return sum.multiplyScalar(this.percentileIrradiance(name, 0.5, true) / lum)
  }

  private gridSums = new Map<string, Float32Array>()

  /**
   * Mean irradiance (RGB, every grid summed) over a receiver's texels inside a world box —
   * for a `noLampDirect` receiver, the daylight + bounce light arriving there.
   */
  meanIrradianceIn(name: string, box: Box3): Color {
    const r = this.receivers.find((x) => x.name === name)
    const mean = new Color(0, 0, 0)
    if (!r) return mean
    let sums = this.gridSums.get(name)
    if (!sums) {
      sums = new Float32Array(GRID * GRID * 3)
      const buffer = new Float32Array(GRID * GRID * 4)
      for (const g of r.grid) {
        this.renderer.readRenderTargetPixels(g, 0, 0, GRID, GRID, buffer)
        for (let t = 0; t < GRID * GRID; t++) {
          sums[t * 3] += buffer[t * 4]!
          sums[t * 3 + 1] += buffer[t * 4 + 1]!
          sums[t * 3 + 2] += buffer[t * 4 + 2]!
        }
      }
      this.gridSums.set(name, sums)
    }
    const grown = box.clone().expandByScalar(0.01)
    const p = new Vector3()
    let n = 0
    for (let t = 0; t < GRID * GRID; t++) {
      if (r.position[t * 4 + 3]! <= 0) continue
      p.set(r.position[t * 4]!, r.position[t * 4 + 1]!, r.position[t * 4 + 2]!)
      if (!grown.containsPoint(p)) continue
      mean.r += sums[t * 3]!
      mean.g += sums[t * 3 + 1]!
      mean.b += sums[t * 3 + 2]!
      n++
    }
    return n > 0 ? mean.multiplyScalar(1 / n) : mean
  }

  /** A (half-float) target's pixels as floats: copied into a float target, then read back. */
  private readFloat(source: WebGLRenderTarget) {
    const { width, height } = source
    const rt = new WebGLRenderTarget(width, height, { type: FloatType })
    const copy = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: `uniform sampler2D uSource; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uSource, vUv); }`,
      uniforms: { uSource: { value: source.texture } },
      depthTest: false,
      depthWrite: false,
    })
    this.quad.material = copy
    this.renderer.setRenderTarget(rt)
    this.renderer.render(this.quadScene, this.quadCamera)
    const pixels = new Float32Array(width * height * 4)
    this.renderer.readRenderTargetPixels(rt, 0, 0, width, height, pixels)
    this.renderer.setRenderTarget(null)
    rt.dispose()
    copy.dispose()
    return { width, height, pixels }
  }

  /** Intensity-weighted mean colour of the mounted lamps (for camera white balance). */
  lampWhite(): Color {
    const sum = new Color(0, 0, 0)
    this.lamps.forEach((l) => sum.add(l.color))
    return sum
  }

  /** Directional lightmap for a `directional` receiver: resolve, then dilate like the light. */
  private resolveDirection(r: ReceiverState): WebGLRenderTarget {
    const renderer = this.renderer
    const a = new WebGLRenderTarget(r.size, r.size, { type: HalfFloatType })
    const b = new WebGLRenderTarget(r.size, r.size, { type: HalfFloatType })
    this.quad.material = this.directionMat
    this.directionMat.uniforms.uDirAccum.value = r.dirAccum!.texture
    this.directionMat.uniforms.uDirect.value = r.accum.texture
    this.directionMat.uniforms.uBounce.value = r.accumBounce.texture
    this.clear(a)
    renderer.render(this.quadScene, this.quadCamera)
    let src = a
    let dst = b
    this.quad.material = this.dilateMat
    this.dilateMat.uniforms.uTexel.value.set(1 / r.size, 1 / r.size)
    for (let i = 0; i < 8; i++) {
      this.dilateMat.uniforms.uSource.value = src.texture
      this.clear(dst)
      renderer.render(this.quadScene, this.quadCamera)
      ;[src, dst] = [dst, src]
    }
    dst.dispose()
    return src
  }

  /** The directional lightmap for a receiver (null unless it was baked `directional`). */
  directionMap(index: number): Texture | null {
    return this.dirOutputs[index]?.texture ?? null
  }

  /**
   * The finished maps, as float RGBA pixels: each receiver's light map and, where it has one,
   * its direction map. Receivers outside `BakeSurface` (the artwork atlas, `art`) are left out.
   * Call after `run()` finishes.
   */
  exportMaps(): {
    receiver: BakeSurface
    kind: BakeMapKind
    pixels: Float32Array
    width: number
    height: number
  }[] {
    const maps: ReturnType<LightBaker['exportMaps']> = []
    this.receivers.forEach((r, i) => {
      if (!BAKE_SURFACES.includes(r.name as BakeSurface)) return
      const receiver = r.name as BakeSurface
      const targets = [
        ['light', this.outputs[i]],
        ['direction', this.dirOutputs[i]],
      ] as const
      for (const [kind, target] of targets) {
        if (!target) continue
        maps.push({ receiver, kind, ...this.readFloat(target) })
      }
    })
    return maps
  }

  /** The finished lightmap for a receiver, in `prepare` order. */
  lightMap(index: number): Texture | null {
    return this.outputs[index]?.texture ?? null
  }

  dispose() {
    this.casters.forEach((m) => m.layers.disable(CASTER_LAYER))
    this.receivers.forEach((r) => {
      r.accum.dispose()
      r.accumBounce.dispose()
      r.grid.forEach((g) => g.dispose())
      r.dirAccum?.dispose()
    })
    this.outputs.forEach((o) => o.dispose())
    this.dirOutputs.forEach((o) => o?.dispose())
    this.shadowRT.dispose()
    this.cubeRT.dispose()
    this.lampCubeRT.dispose()
    ;[
      this.distanceMat,
      this.spotMat,
      this.vplMat,
      this.geometryMat,
      this.resolveMat,
      this.dilateMat,
      this.combineMat,
      this.directionMat,
      this.addMat,
    ].forEach((m) => m.dispose())
    this.quad.geometry.dispose()
  }
}
