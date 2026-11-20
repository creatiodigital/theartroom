/**
 * The print's three PHOTO VIEWS (owner, 2026-11-20; see
 * docs/superpowers/specs/2026-11-20-print-photo-views-design.md): the bare sheet lying on a white
 * table shot at a corner, and two angled close-ups — made to pass for real photographs of the
 * printed work. Rendered in the admin's browser with the framed presentation, one Render press.
 *
 * Unlike the framed presentation, the artwork IS in these shots (owner, option A): it takes the
 * photo's light, the paper's grain and the lens's focus blur, like a real print would. The light
 * is neutral white and nothing raises exposure, so its sharp parts stay within a few shades of
 * the file.
 *
 * How: plain three.js, many passes averaged. Each pass moves the lens across its aperture (thin
 * lens: real depth of field), the key light across a softbox (real soft shadows), the room light to
 * a new direction of the sky dome (real ambient occlusion under the lifted paper) and the pixel
 * grid by a sub-pixel (antialiasing). The average of 256 passes is the photograph.
 *
 * 🔒 The look was approved by the owner on 2026-11-20 ("I approve the renders!"). Don't retune its
 * values; bump PHOTO_LOOK_VERSION (photoInputs.ts) for any change to how a photo looks.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DirectionalLight,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  NoColorSpace,
  NoToneMapping,
  Object3D,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SpotLight,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three'

import {
  EDITION_INK_TOP_EM,
  EDITION_NUMBER_CLEARANCE_CM,
  EDITION_NUMBER_FONT_SIZE_CM,
  editionLeftBearingEm,
} from '@/components/PrintWizard/editionNumberMetrics'
import { random } from '@/lib/printPresentation/look'

import type { PhotoSheet as PhotoSheetCm } from '@/lib/printPresentation/photoInputs'
import { PHOTO_WIDTH_PX, type PhotoViewKind } from '@/lib/printPresentation/record'

/** The printed sheet, in centimetres, and the pencilled "copy/N" under its image (or null). */
export type PhotoSheet = PhotoSheetCm & { number: string | null }

export type PhotoViewJob = {
  /** The work's web image, loaded with `crossOrigin = 'anonymous'`. */
  image: HTMLImageElement
  sheet: PhotoSheet
  seed: number
  view: PhotoViewKind
}

/** The stored photo's size (3:2) and how many passes make it. */
const WIDTH = PHOTO_WIDTH_PX.large
const HEIGHT = Math.round((WIDTH * 2) / 3)
const PASSES = 256

// ---------------------------------------------------------------------------------------------
// The look (approved 2026-11-20)

/** Paper white, in sRGB: fine-art matte paper. */
const PAPER = '#fbfaf6'
/** The table: a white matte top, a hair grayer than the paper so the sheet reads against it. */
const TABLE = '#ececea'
/** Graphite, as an albedo (it is lit, like the paper). */
const GRAPHITE = '#9a9b9d'
/** What a white, unshadowed, flat surface returns: just under white, so nothing clips. */
const EXPOSURE = 0.985
const PAPER_THICKNESS_M = 0.0004
/** One tile of paper grain covers this much paper. */
const GRAIN_TILE_M = 0.03
const SENSOR_HALF_H_M = 0.012 // full frame, 36 × 24 mm
/**
 * The corner shot's versions (owner: "create 3 - 4 versions and just pick randomly 1 of them when
 * rendering"). Each work gets one, by its seed, plus a small nudge. Offsets in metres from the
 * image's bottom-left corner (dx right, dz into the image is negative).
 * 0 is the approved one, after White Cube's: low, nearly side-on. Equal margins look unequal from
 * there (the bottom one foreshortened, ~1 : 1.36); the owner accepted it ("if it's the angle,
 * never mind").
 */
export const SHEET_SHOTS = [
  { dx: 0.025, dz: -0.01, azimuth: -0.42, elevation: 0.62, distance: 0.76, fNumber: 8 },
  // From higher above: the sheet flatter, more of the image.
  { dx: 0.03, dz: -0.025, azimuth: -0.6, elevation: 0.88, distance: 0.8, fNumber: 8 },
  // Lower, the bottom edge nearly across the frame, the far side softer.
  { dx: 0.035, dz: -0.005, azimuth: -0.22, elevation: 0.5, distance: 0.72, fNumber: 7.1 },
  // From further left: the left edge runs across, the bottom edge climbs.
  { dx: 0.01, dz: -0.03, azimuth: -0.95, elevation: 0.66, distance: 0.78, fNumber: 8 },
] as const

// ---------------------------------------------------------------------------------------------
// Paper grain: a tileable height field (fibres + tooth), as a normal map with the height in alpha.

function periodicBlur(src: Float32Array, size: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const span = 2 * radius + 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) s += src[y * size + ((x + k + size) % size)]
      tmp[y * size + x] = s / span
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      for (let k = -radius; k <= radius; k++) s += tmp[((y + k + size) % size) * size + x]
      out[y * size + x] = s / span
    }
  }
  return out
}

function normalise(a: Float32Array): Float32Array {
  let mean = 0
  for (const v of a) mean += v
  mean /= a.length
  let variance = 0
  for (const v of a) variance += (v - mean) ** 2
  const sd = Math.sqrt(variance / a.length) || 1
  return a.map((v) => (v - mean) / sd)
}

function makeGrain(size: number, seed: number, strength: number): DataTexture {
  const r = random(seed)
  const white = new Float32Array(size * size).map(() => r())
  // Fibres run mostly one way in machine-made paper: a longer blur along x for the finest layer.
  const fine = normalise(periodicBlur(white, size, 1))
  const mid = normalise(periodicBlur(white, size, 3))
  const low = normalise(periodicBlur(white, size, 10))
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = 0.5 * fine[i] + 0.35 * mid[i] + 0.25 * low[i]
  const data = new Uint8Array(size * size * 4)
  let min = Infinity
  let max = -Infinity
  for (const v of h) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (xx: number, yy: number) => h[((yy + size) % size) * size + ((xx + size) % size)]
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      data[i + 3] = Math.round(((h[y * size + x] - min) / (max - min)) * 255)
    }
  }
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = NoColorSpace
  t.generateMipmaps = true
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  t.needsUpdate = true
  return t
}

// ---------------------------------------------------------------------------------------------
// The pencilled number, drawn as a mask (graphite catches on the paper's tooth: broken strokes).

const PENCIL_PX_PER_CM = 220

async function pencilMask(label: string, seed: number) {
  const face = new FontFace('CaveatPhoto', 'url(/fonts/caveat-regular.ttf)')
  await face.load()
  document.fonts.add(face)
  const fontPx = EDITION_NUMBER_FONT_SIZE_CM * 0.75 * PENCIL_PX_PER_CM
  const wCm = 12
  const hCm = 3
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(wCm * PENCIL_PX_PER_CM)
  canvas.height = Math.round(hCm * PENCIL_PX_PER_CM)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = `${fontPx}px CaveatPhoto`
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'alphabetic'
  // Ink top 0.3 cm under the image, ink left on the image's left edge (as the framed render).
  const left = 1 * PENCIL_PX_PER_CM - editionLeftBearingEm(label) * fontPx
  const baseline = EDITION_NUMBER_CLEARANCE_CM * PENCIL_PX_PER_CM + EDITION_INK_TOP_EM * fontPx
  ctx.fillText(label, left, baseline)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const r = random(seed ^ 0x51ed)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = img.data[i] / 255
    const tooth = 0.55 + 0.45 * r()
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * tooth * 255)
  }
  ctx.putImageData(img, 0, 0)
  const t = new CanvasTexture(canvas)
  t.colorSpace = NoColorSpace
  t.minFilter = LinearMipmapLinearFilter
  t.generateMipmaps = true
  // The canvas's top-left sits 1 cm left of the image's left edge, at the image's bottom edge.
  return { texture: t, wCm, hCm }
}

// ---------------------------------------------------------------------------------------------
// Detail: where the image has something to look at (a close-up of an empty sky is no photo).

function detailMap(image: HTMLImageElement) {
  const long = 96
  const s = long / Math.max(image.naturalWidth, image.naturalHeight)
  const w = Math.max(8, Math.round(image.naturalWidth * s))
  const h = Math.max(8, Math.round(image.naturalHeight * s))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) lum[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]
  const g = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      g[i] = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + w] - lum[i - w])
    }
  }
  // Mean detail in a window ~12% of the long side round each point. (u, v): v = 0 at the bottom.
  return (u: number, v: number) => {
    const cx = Math.round(u * (w - 1))
    const cy = Math.round((1 - v) * (h - 1))
    const rad = Math.round(long * 0.06)
    let s2 = 0
    let n = 0
    for (let y = Math.max(0, cy - rad); y <= Math.min(h - 1, cy + rad); y++) {
      for (let x = Math.max(0, cx - rad); x <= Math.min(w - 1, cx + rad); x++) {
        s2 += g[y * w + x]
        n++
      }
    }
    return n ? s2 / n : 0
  }
}

function pickPoint(
  detail: (u: number, v: number) => number,
  r: () => number,
  box: { u0: number; u1: number; v0: number; v1: number },
  tries = 28,
) {
  let best = { u: 0.5, v: 0.5, score: -1 }
  for (let i = 0; i < tries; i++) {
    const u = box.u0 + (box.u1 - box.u0) * r()
    const v = box.v0 + (box.v1 - box.v0) * r()
    // A little chance in it, so two works with similar images don't get the same framing.
    const score = detail(u, v) * (0.75 + 0.5 * r())
    if (score > best.score) best = { u, v, score }
  }
  return best
}

// ---------------------------------------------------------------------------------------------

type Shot = {
  target: Vector3
  azimuth: number
  elevation: number
  distance: number
  focal: number
  fNumber: number
  /** The camera's tilt round its own axis, as a hand-held shot never is quite level. */
  roll?: number
}

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export class PhotoRenderer {
  readonly renderer: WebGLRenderer
  private grain: DataTexture
  private tableGrain: DataTexture

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.renderer.shadowMap.autoUpdate = true
    this.renderer.toneMapping = NoToneMapping
    this.renderer.outputColorSpace = SRGBColorSpace
    this.grain = makeGrain(1024, 11, 2.2)
    this.tableGrain = makeGrain(512, 23, 1.2)
    const aniso = this.renderer.capabilities.getMaxAnisotropy()
    this.grain.anisotropy = aniso
    this.tableGrain.anisotropy = aniso
  }

  /** Frees the GPU at once (a batch's context is released before the next page needs one). */
  dispose() {
    this.grain.dispose()
    this.tableGrain.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  /** Renders one view into this renderer's canvas (2400 × 1600) and returns that canvas. */
  async render(job: PhotoViewJob): Promise<HTMLCanvasElement> {
    const { sheet, seed, view } = job
    const width = WIDTH
    const height = HEIGHT
    const passes = PASSES
    const renderer = this.renderer
    renderer.setSize(width, height, false)
    const aniso = renderer.capabilities.getMaxAnisotropy()

    // --- The sheet ---------------------------------------------------------------------------
    const cm = (v: number) => v / 100
    const pw = cm(sheet.left + sheet.imageW + sheet.right)
    const ph = cm(sheet.bottom + sheet.imageH + sheet.top)
    const work = random(seed) // the work's own draw: its paper, its light
    const between = (r: () => number, a: number, b: number) => a + (b - a) * r()

    // How the paper lies: flat in the middle, its edges and corners easing off the table.
    const edges = [0, 1, 2, 3].map(() => ({
      a: between(work, 0.0003, 0.0009),
      reach: between(work, 0.02, 0.05),
    }))
    const corners = [0, 1, 2, 3].map(() => ({
      a: between(work, 0.0005, 0.0018),
      reach: between(work, 0.04, 0.08),
    }))
    // The corner the sheet view is shot at always lifts a little: its shadow tells it's paper.
    // Which corner that is comes from the shot's own first two draws (read here, drawn again in
    // the same order below, so the shot itself doesn't change).
    const sheetPick = (() => {
      const peek = random(seed ^ 0x1111)
      const pick = Math.floor(peek() * SHEET_SHOTS.length)
      const mirror = !sheet.number && peek() < 0.5
      return { pick, mirror }
    })()
    // Every view of a work shows the same sheet, so this is decided the same way in all three.
    const shotCorner = sheetPick.mirror ? 1 : 0 // 0 bottom-left, 1 bottom-right
    corners[shotCorner].a = Math.max(corners[shotCorner].a, 0.0016)
    const waves = [0, 1].map(() => ({
      k: (2 * Math.PI) / between(work, 0.12, 0.25),
      dir: between(work, 0, Math.PI),
      phase: between(work, 0, 2 * Math.PI),
    }))
    const cockle = between(work, 0.00008, 0.00025)
    const ease = (t: number) => {
      const s = Math.min(1, Math.max(0, t))
      const sm = s * s * (3 - 2 * s)
      return (1 - sm) * (1 - sm)
    }
    const lift = (x: number, z: number) => {
      const dl = x + pw / 2
      const dr = pw / 2 - x
      const dn = ph / 2 - z // near edge = the print's bottom
      const df = z + ph / 2
      let y = 0
      ;[dl, dr, dn, df].forEach((d, i) => (y += edges[i].a * ease(d / edges[i].reach)))
      // corners: 0 bottom-left, 1 bottom-right, 2 top-right, 3 top-left
      const cd = [Math.hypot(dl, dn), Math.hypot(dr, dn), Math.hypot(dr, df), Math.hypot(dl, df)]
      cd.forEach((d, i) => (y += corners[i].a * ease(d / corners[i].reach)))
      let w = cockle
      for (const wave of waves) {
        const p = x * Math.cos(wave.dir) + z * Math.sin(wave.dir)
        w *= 0.5 + 0.5 * Math.sin(p * wave.k + wave.phase)
      }
      return y + w * 4
    }

    const segX = Math.min(480, Math.ceil(pw / 0.002))
    const segZ = Math.min(480, Math.ceil(ph / 0.002))
    const geometry = new BoxGeometry(pw, PAPER_THICKNESS_M, ph, segX, 1, segZ)
    const pos = geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) + PAPER_THICKNESS_M / 2 + lift(pos.getX(i), pos.getZ(i)))
    }
    geometry.computeVertexNormals()

    const art = new Texture(job.image)
    art.colorSpace = SRGBColorSpace
    art.anisotropy = aniso
    art.minFilter = LinearMipmapLinearFilter
    art.generateMipmaps = true
    art.needsUpdate = true

    const pencil = sheet.number ? await pencilMask(sheet.number, seed) : null

    const grain = this.grain
    grain.repeat.set(pw / GRAIN_TILE_M, ph / GRAIN_TILE_M)
    const top = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
      normalMap: grain,
      normalScale: new Vector2(0.35, 0.35),
    })
    const uImg = [cm(sheet.left) / pw, cm(sheet.bottom) / ph, cm(sheet.imageW) / pw, cm(sheet.imageH) / ph]
    // The pencil canvas: 1 cm left of the image's left edge, its top at the image's bottom edge.
    const uPencil = pencil
      ? [
          (cm(sheet.left) - 0.01) / pw,
          (cm(sheet.bottom) - cm(pencil.hCm)) / ph,
          cm(pencil.wCm) / pw,
          cm(pencil.hCm) / ph,
        ]
      : [0, 0, 0, 0]
    top.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        uArt: { value: art },
        uImg: { value: uImg },
        uPencil: { value: pencil?.texture ?? art },
        uPencilRect: { value: uPencil },
        uHasPencil: { value: pencil ? 1 : 0 },
        uPaper: { value: new Color(PAPER) },
        uGraphite: { value: new Color(GRAPHITE) },
        uGrainAlbedo: { value: 0.05 },
      })
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vSheetUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSheetUv = uv;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vSheetUv;
          uniform sampler2D uArt; uniform vec4 uImg;
          uniform sampler2D uPencil; uniform vec4 uPencilRect; uniform float uHasPencil;
          uniform vec3 uPaper; uniform vec3 uGraphite; uniform float uGrainAlbedo;`,
        )
        .replace(
          '#include <map_fragment>',
          `{
            vec2 iuv = (vSheetUv - uImg.xy) / uImg.zw;
            float inImg = step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
            vec3 artC = texture2D(uArt, clamp(iuv, 0.0, 1.0)).rgb;
            vec2 puv = (vSheetUv - uPencilRect.xy) / uPencilRect.zw;
            float inPen = step(0.0, puv.x) * step(puv.x, 1.0) * step(0.0, puv.y) * step(puv.y, 1.0);
            // The canvas's y runs down; the sheet's v runs up.
            float pen = uHasPencil * inPen * texture2D(uPencil, vec2(puv.x, puv.y)).r;
            vec3 paperC = mix(uPaper, uGraphite, pen);
            float tooth = texture2D(normalMap, vNormalMapUv).a;
            diffuseColor.rgb *= mix(paperC, artC, inImg) * (1.0 + uGrainAlbedo * (tooth - 0.5));
          }`,
        )
    }
    const side = new MeshStandardMaterial({ color: PAPER, roughness: 0.95 })
    const paper = new Mesh(geometry, [side, side, top, side, side, side])
    paper.castShadow = true
    paper.receiveShadow = true

    // --- The table -------------------------------------------------------------------------------
    const tableGrain = this.tableGrain
    tableGrain.repeat.set(8 / 0.12, 8 / 0.12)
    const table = new Mesh(
      new PlaneGeometry(8, 8),
      new MeshStandardMaterial({
        color: TABLE,
        roughness: 0.9,
        normalMap: tableGrain,
        normalScale: new Vector2(0.05, 0.05),
      }),
    )
    table.rotation.x = -Math.PI / 2
    table.receiveShadow = true

    const scene = new Scene()
    scene.background = new Color(TABLE)
    scene.add(table, paper)

    // --- The shot --------------------------------------------------------------------------------
    const shotRand = random(seed ^ { sheet: 0x1111, close: 0x2222, edge: 0x3333 }[view])
    const imageAt = (u: number, v: number) =>
      new Vector3(-pw / 2 + cm(sheet.left) + u * cm(sheet.imageW), 0, ph / 2 - cm(sheet.bottom) - v * cm(sheet.imageH))
    let shot: Shot
    if (view === 'sheet') {
      // Down onto a corner, aimed a little into the image so a good part of it shows (owner: "not
      // that zoomed in, show me more of the image… a little more"), the paper's corner and the
      // number still in. One of the versions, by the work's seed, nudged a little. A sheet
      // without a pencilled number may be shot at its bottom-right corner instead (mirrored), so
      // even fewer works share a composition (owner: "I don't want users to notice the
      // similarity when navigating over different artworks").
      const nudge = (spread: number) => (shotRand() * 2 - 1) * spread
      shotRand() // the version (sheetPick.pick)
      const base = SHEET_SHOTS[sheetPick.pick]
      shotRand() // the mirror draw (sheetPick.mirror)
      const mirror = sheetPick.mirror
      const m = mirror ? -1 : 1
      const corner = mirror ? imageAt(1, 0) : imageAt(0, 0)
      shot = {
        target: corner
          .clone()
          .add(new Vector3(m * (base.dx + nudge(0.006)), 0, base.dz + nudge(0.006))),
        azimuth: m * (base.azimuth + nudge(0.04)),
        elevation: base.elevation + nudge(0.025),
        distance: base.distance + nudge(0.03),
        roll: m * nudge(0.02),
        focal: 0.09,
        fNumber: base.fNumber,
      }
    } else {
      const detail = detailMap(job.image)
      const close = view === 'close'
      const p = close
        ? pickPoint(detail, shotRand, { u0: 0.22, u1: 0.78, v0: 0.25, v1: 0.7 })
        : pickPoint(detail, shotRand, { u0: 0.2, u1: 0.8, v0: 0.72, v1: 0.86 })
      const sign = shotRand() < 0.5 ? -1 : 1
      shot = close
        ? {
            target: imageAt(p.u, p.v),
            azimuth: between(shotRand, -0.35, 0.35),
            elevation: between(shotRand, 0.5, 0.72),
            distance: between(shotRand, 0.4, 0.5),
            focal: 0.1,
            fNumber: between(shotRand, 3.5, 5.6),
          }
        : {
            target: imageAt(p.u, p.v),
            azimuth: sign * between(shotRand, 0.2, 0.5),
            elevation: between(shotRand, 0.6, 0.82),
            distance: between(shotRand, 0.48, 0.6),
            focal: between(shotRand, 0.075, 0.09),
            fNumber: between(shotRand, 4, 6.3),
          }
    }
    shot.target.y = lift(shot.target.x, shot.target.z) + PAPER_THICKNESS_M

    const dir = new Vector3(
      Math.sin(shot.azimuth) * Math.cos(shot.elevation),
      Math.sin(shot.elevation),
      Math.cos(shot.azimuth) * Math.cos(shot.elevation),
    )
    const camPos = shot.target.clone().addScaledVector(dir, shot.distance)
    const camera = new PerspectiveCamera()
    camera.position.copy(camPos)
    camera.up.set(0, 1, 0)
    camera.lookAt(shot.target)
    camera.rotateZ(shot.roll ?? 0)
    camera.updateMatrixWorld()
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    // Thin lens: focused at the target, the image distance sets the field of view.
    const v = 1 / (1 / shot.focal - 1 / shot.distance)
    const halfH = SENSOR_HALF_H_M / v
    const near = 0.02
    const far = 20
    const aspect = width / height
    const aperture = shot.focal / shot.fNumber / 2


    // --- The light ---------------------------------------------------------------------------------
    // A softbox to one side and a little behind (the work's own draw, so all its photos share it),
    // and the room: a dome of soft white light all round.
    const lightRand = random(seed ^ 0x7777)
    const keySide = lightRand() < 0.5 ? -1 : 1
    const keyAz = keySide * between(lightRand, 1.6, 2.4)
    const keyEl = between(lightRand, 0.85, 1.1)
    const keyDist = between(lightRand, 1.7, 2.3)
    const keyShare = between(lightRand, 0.5, 0.62)
    const softbox = 0.9
    const keyCentre = new Vector3(
      Math.sin(keyAz) * Math.cos(keyEl),
      Math.sin(keyEl),
      Math.cos(keyAz) * Math.cos(keyEl),
    )
      .multiplyScalar(keyDist)
      .add(new Vector3(shot.target.x, 0, shot.target.z))
    const keyNormal = keyCentre.clone().sub(shot.target).normalize()
    const keyU = new Vector3().crossVectors(keyNormal, new Vector3(0, 1, 0)).normalize()
    const keyV = new Vector3().crossVectors(keyU, keyNormal).normalize()

    const E = Math.PI * EXPOSURE
    const key = new SpotLight(0xffffff, 1, 0, Math.atan(0.5 / keyDist), 0, 2)
    key.castShadow = true
    key.shadow.mapSize.set(4096, 4096)
    key.shadow.bias = -0.00003
    key.shadow.normalBias = 0
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 6
    const keyTarget = new Object3D()
    keyTarget.position.copy(shot.target)
    key.target = keyTarget
    const room = new DirectionalLight(0xffffff, 1)
    room.castShadow = true
    room.shadow.mapSize.set(2048, 2048)
    room.shadow.bias = -0.00005
    const sc = room.shadow.camera as OrthographicCamera
    sc.left = sc.bottom = -0.45
    sc.right = sc.top = 0.45
    sc.near = 0.05
    sc.far = 6
    const roomTarget = new Object3D()
    roomTarget.position.copy(shot.target)
    room.target = roomTarget
    scene.add(key, keyTarget, room, roomTarget)

    // --- Accumulate ---------------------------------------------------------------------------------
    // Sampled pixel for pixel, so no filtering (float textures needn't be filterable).
    const passRT = new WebGLRenderTarget(width, height, {
      type: HalfFloatType,
      depthBuffer: true,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    })
    const acc = [0, 1].map(
      () =>
        new WebGLRenderTarget(width, height, {
          type: FloatType,
          depthBuffer: false,
          minFilter: NearestFilter,
          magFilter: NearestFilter,
        }),
    )
    const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const average = new ShaderMaterial({
      uniforms: { tPass: { value: null }, tAcc: { value: null }, uWeight: { value: 1 } },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tPass; uniform sampler2D tAcc; uniform float uWeight; varying vec2 vUv;
        void main() { gl_FragColor = mix(texture2D(tAcc, vUv), texture2D(tPass, vUv), uWeight); }
      `,
      depthTest: false,
      depthWrite: false,
    })
    const output = new ShaderMaterial({
      uniforms: { tAcc: { value: null }, uSeed: { value: (seed % 997) / 7.0 }, uAspect: { value: aspect } },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tAcc; uniform float uSeed; uniform float uAspect; varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec3 c = texture2D(tAcc, vUv).rgb;
          // A lens's gentle fall-off towards the corners.
          vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
          c *= 1.0 - 0.05 * dot(q, q);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          // Dither plus a whisper of sensor noise, in the 8-bit output.
          float n = hash(gl_FragCoord.xy + uSeed) + hash(gl_FragCoord.xy * 1.37 + uSeed * 3.1) - 1.0;
          gl_FragColor.rgb += n * (1.4 / 255.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    const quad = new Mesh(new PlaneGeometry(2, 2), average)
    quad.frustumCulled = false
    const quadScene = new Scene()
    quadScene.add(quad)

    const passRand = random(seed ^ 0x9999 ^ passes)
    const keyPos = new Vector3()
    const up0 = new Vector3(0, 1, 0)
    const PASSES_PER_FRAME = 6
    let read = 0
    for (let i = 0; i < passes; i++) {
      // Lens: a point on the aperture (uniform disk), plus a sub-pixel jitter.
      const rr = Math.sqrt(passRand()) * aperture
      const th = 2 * Math.PI * passRand()
      const ax = rr * Math.cos(th)
      const ay = rr * Math.sin(th)
      camera.position.copy(camPos).addScaledVector(right, ax).addScaledVector(up, ay)
      camera.updateMatrixWorld()
      const t = near * halfH
      const r = t * aspect
      const sx = (-ax * near) / shot.distance + (passRand() - 0.5) * ((2 * r) / width)
      const sy = (-ay * near) / shot.distance + (passRand() - 0.5) * ((2 * t) / height)
      camera.projectionMatrix.makePerspective(-r + sx, r + sx, t + sy, -t + sy, near, far)
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()

      // Key: a point on the softbox; each sample lands the same irradiance on the target.
      keyPos
        .copy(keyCentre)
        .addScaledVector(keyU, (passRand() - 0.5) * softbox)
        .addScaledVector(keyV, (passRand() - 0.5) * softbox)
      key.position.copy(keyPos)
      const kd = keyPos.distanceTo(shot.target)
      const kcos = keyPos.clone().sub(shot.target).normalize().dot(up0)
      key.intensity = (keyShare * E * kd * kd) / kcos

      // Room: a direction on the dome, cosine-weighted; its weight keeps the dome's radiance even.
      const u1 = passRand()
      const u2 = passRand()
      const sr = Math.sqrt(u1)
      const cosT = Math.max(0.12, Math.sqrt(1 - u1))
      const rd = new Vector3(sr * Math.cos(2 * Math.PI * u2), Math.sqrt(1 - u1), sr * Math.sin(2 * Math.PI * u2))
      room.position.copy(shot.target).addScaledVector(rd, 3)
      room.intensity = ((1 - keyShare) * E) / cosT

      renderer.setRenderTarget(passRT)
      renderer.render(scene, camera)

      average.uniforms.tPass.value = passRT.texture
      average.uniforms.tAcc.value = acc[read].texture
      average.uniforms.uWeight.value = 1 / (i + 1)
      quad.material = average
      renderer.setRenderTarget(acc[1 - read])
      renderer.render(quadScene, quadCam)
      read = 1 - read

      // A breath every few passes, so the admin page stays responsive while it renders.
      if ((i + 1) % PASSES_PER_FRAME === 0) {
        await new Promise((res) => requestAnimationFrame(() => res(null)))
      }
    }

    output.uniforms.tAcc.value = acc[read].texture
    quad.material = output
    renderer.setRenderTarget(null)
    renderer.render(quadScene, quadCam)

    // --- Clean up -------------------------------------------------------------------------------
    for (const rt of [passRT, ...acc]) rt.dispose()
    geometry.dispose()
    top.dispose()
    side.dispose()
    art.dispose()
    pencil?.texture.dispose()
    table.geometry.dispose()
    ;(table.material as MeshStandardMaterial).dispose()
    key.shadow.map?.dispose()
    room.shadow.map?.dispose()
    average.dispose()
    output.dispose()
    quad.geometry.dispose()
    return renderer.domElement
  }
}
