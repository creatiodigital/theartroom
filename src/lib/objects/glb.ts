/**
 * The GLB contract for an Object's 3D model (docs/objects "The GLB contract", owner Q-O8): the
 * checks a file must pass before it is stored. ONE set of rules, fed with facts gathered in the
 * browser before upload (the Khronos validator, three.js loading and rendering the file) and
 * again on the server after it (the validator, @gltf-transform reading it). Nothing uploads, and
 * nothing is stored, while any row fails.
 *
 * Pure and client-safe: no Node, no three.js, no validator import here.
 */

export const GLB_MAX_BYTES = 30 * 1024 * 1024
const TRIANGLE_WARN = 500_000
const TEXTURE_WARN_PX = 4096
const TEXTURE_FAIL_PX = 8192
/** Sizes within this of the Details size match: the larger of 1 cm and 3 %. */
const SIZE_TOLERANCE = { cm: 1, ratio: 0.03 }
/** The base rests on y = 0 and sits centred, within half a centimetre / 1 cm or 2 %. */
const BASE_TOLERANCE_CM = 0.5
const CENTRE_TOLERANCE = { cm: 1, ratio: 0.02 }

export type GlbCheckStatus = 'pass' | 'warn' | 'fail'
export type GlbCheckRow = { id: string; label: string; status: GlbCheckStatus; detail: string }

export type GlbValidatorMessage = {
  code: string
  message: string
  severity: number // 0 error · 1 warning · 2 info · 3 hint
  pointer?: string
}

/** What the rules need to know about a file; each side fills what it can measure. */
export type GlbFacts = {
  sizeBytes: number
  /** A binary glTF 2.0 file (header and JSON chunk read). */
  isGlb: boolean
  /** The Khronos validator's issues; null when it could not run (which fails). */
  validator: { errors: number; warnings: number; messages: GlbValidatorMessage[] } | null
  validatorError?: string
  /** Buffers or images that point outside the file. */
  externalUris: string[]
  extensionsUsed: string[]
  triangles: number | null
  textures: { mimeType: string; width: number | null; height: number | null }[]
  /** World-space bounds in metres (1 unit = 1 m); null when there is nothing to draw. */
  bounds: { min: [number, number, number]; max: [number, number, number] } | null
  /** Browser: loaded with the room's loaders and drawn. Server: read by @gltf-transform. */
  opened: { ok: boolean; error?: string; by: 'render' | 'read' }
}

export type DetailsSize = {
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
}

export type BoundsCm = { h: number; w: number; d: number }

const round1 = (n: number) => Math.round(n * 10) / 10

/** The model's size in cm: H = y, W = x, D = z (+Y up, 1 unit = 1 m). */
export function boundsToCm(bounds: GlbFacts['bounds']): BoundsCm | null {
  if (!bounds) return null
  const [x0, y0, z0] = bounds.min
  const [x1, y1, z1] = bounds.max
  return { h: round1((y1 - y0) * 100), w: round1((x1 - x0) * 100), d: round1((z1 - z0) * 100) }
}

const cmText = (b: BoundsCm) => `${b.h} × ${b.w} × ${b.d} cm`

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const withinTolerance = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(SIZE_TOLERANCE.cm, SIZE_TOLERANCE.ratio * Math.max(a, b))

/**
 * The size check alone (also shown on the ready model): matches when height, width and depth
 * are each within 1 cm or 3 % of the Details size. Never blocks.
 */
export function sizeCheck(
  model: BoundsCm | null,
  details: DetailsSize,
): { status: 'match' | 'differ' | 'unknown'; text: string } {
  const { heightCm: h, widthCm: w, depthCm: d } = details
  if (!model) return { status: 'unknown', text: 'No size could be read from the model' }
  if (!h || !w || !d) return { status: 'unknown', text: 'No full size in Details to compare' }
  const match =
    withinTolerance(model.h, h) && withinTolerance(model.w, w) && withinTolerance(model.d, d)
  return match
    ? { status: 'match', text: 'Matches the size in Details' }
    : { status: 'differ', text: `Differs from the size in Details (${h} × ${w} × ${d} cm)` }
}

/** The rows, in reading order. Upload only when none fails (`glbPasses`). */
export function checkGlb(facts: GlbFacts, details: DetailsSize): GlbCheckRow[] {
  const rows: GlbCheckRow[] = []
  const row = (id: string, label: string, status: GlbCheckStatus, detail: string) =>
    rows.push({ id, label, status, detail })

  row(
    'format',
    'One binary .glb',
    facts.isGlb ? 'pass' : 'fail',
    facts.isGlb ? 'glTF 2.0, binary' : 'Not a binary glTF 2.0 file (.glb)',
  )

  row(
    'size',
    'File size',
    facts.sizeBytes > GLB_MAX_BYTES ? 'fail' : 'pass',
    facts.sizeBytes > GLB_MAX_BYTES
      ? `${megabytes(facts.sizeBytes)}: at most ${megabytes(GLB_MAX_BYTES)}`
      : megabytes(facts.sizeBytes),
  )

  if (!facts.validator) {
    row(
      'validator',
      'glTF validator',
      'fail',
      `Could not run: ${facts.validatorError ?? 'unknown error'}`,
    )
  } else {
    const errors = facts.validator.messages.filter((m) => m.severity === 0)
    const warnings = facts.validator.messages.filter((m) => m.severity === 1)
    const list = (ms: GlbValidatorMessage[]) =>
      ms
        .slice(0, 3)
        .map((m) => `${m.message}${m.pointer ? ` (${m.pointer})` : ''}`)
        .join(' · ')
    if (facts.validator.errors > 0) {
      row(
        'validator',
        'glTF validator',
        'fail',
        `${facts.validator.errors} error(s): ${list(errors)}`,
      )
    } else if (facts.validator.warnings > 0) {
      row(
        'validator',
        'glTF validator',
        'warn',
        `${facts.validator.warnings} warning(s): ${list(warnings)}`,
      )
    } else {
      row('validator', 'glTF validator', 'pass', 'No errors or warnings')
    }
  }

  row(
    'opened',
    facts.opened.by === 'render' ? 'Opens and renders' : 'Reads cleanly',
    facts.opened.ok ? 'pass' : 'fail',
    facts.opened.ok
      ? facts.opened.by === 'render'
        ? 'Loaded with the 3D room’s loaders and drawn'
        : 'Read and decoded on the server'
      : (facts.opened.error ?? 'It could not be opened'),
  )

  row(
    'embedded',
    'Everything inside the file',
    facts.externalUris.length ? 'fail' : 'pass',
    facts.externalUris.length
      ? `Points outside the file: ${facts.externalUris.slice(0, 3).join(', ')}`
      : 'Geometry and textures embedded',
  )

  const quantized = facts.extensionsUsed.includes('KHR_mesh_quantization')
  row(
    'quantization',
    'Not quantized',
    quantized ? 'fail' : 'pass',
    quantized
      ? 'Uses KHR_mesh_quantization: export again without quantizing'
      : 'Full-precision geometry',
  )

  const meshopt = facts.extensionsUsed.includes('EXT_meshopt_compression')
  row(
    'compression',
    'meshopt compression',
    meshopt ? 'pass' : 'warn',
    meshopt ? 'Compressed with meshopt' : 'Not compressed: a larger download',
  )

  if (facts.textures.length === 0) {
    row('textures', 'Textures', 'warn', 'No textures: the AO is expected baked into them')
  } else {
    const largest = Math.max(...facts.textures.map((t) => Math.max(t.width ?? 0, t.height ?? 0)))
    const formats = [
      ...new Set(facts.textures.map((t) => t.mimeType.replace('image/', '').toUpperCase())),
    ]
    const otherFormat = facts.textures.some(
      (t) => t.mimeType !== 'image/webp' && t.mimeType !== 'image/ktx2',
    )
    const line = `${facts.textures.length} · up to ${largest || '?'} px · ${formats.join(', ')}`
    if (largest > TEXTURE_FAIL_PX) {
      row('textures', 'Textures', 'fail', `${line}: at most ${TEXTURE_FAIL_PX} px`)
    } else if (largest > TEXTURE_WARN_PX || otherFormat) {
      row(
        'textures',
        'Textures',
        'warn',
        `${line}${largest > TEXTURE_WARN_PX ? `: above ${TEXTURE_WARN_PX} px` : ''}${
          otherFormat ? ': WebP or KTX2 expected' : ''
        }`,
      )
    } else {
      row('textures', 'Textures', 'pass', line)
    }
  }

  if (facts.triangles === null) {
    row('triangles', 'Triangles', 'warn', 'Not counted')
  } else {
    row(
      'triangles',
      'Triangles',
      facts.triangles > TRIANGLE_WARN ? 'warn' : 'pass',
      `${facts.triangles.toLocaleString('en-US')}${
        facts.triangles > TRIANGLE_WARN
          ? `: heavy for phones (above ${TRIANGLE_WARN.toLocaleString('en-US')})`
          : ''
      }`,
    )
  }

  const cm = boundsToCm(facts.bounds)
  if (!cm || !facts.bounds) {
    row('realSize', 'Real size', 'fail', 'Nothing to draw: no geometry found')
  } else {
    const largest = Math.max(cm.h, cm.w, cm.d)
    const odd = largest < 1 || largest > 2000
    row(
      'realSize',
      'Real size',
      odd ? 'warn' : 'pass',
      odd ? `${cmText(cm)}: check the scale (1 unit = 1 m)` : cmText(cm),
    )

    const check = sizeCheck(cm, details)
    row('sizeCheck', 'Size check', check.status === 'match' ? 'pass' : 'warn', check.text)

    const baseCm = round1(facts.bounds.min[1] * 100)
    row(
      'base',
      'Base on the floor',
      Math.abs(baseCm) <= BASE_TOLERANCE_CM ? 'pass' : 'warn',
      Math.abs(baseCm) <= BASE_TOLERANCE_CM
        ? 'Rests on y = 0'
        : `The lowest point is at y = ${baseCm} cm: it should rest on y = 0`,
    )

    const cx = ((facts.bounds.min[0] + facts.bounds.max[0]) / 2) * 100
    const cz = ((facts.bounds.min[2] + facts.bounds.max[2]) / 2) * 100
    const off = (centre: number, side: number) =>
      Math.abs(centre) > Math.max(CENTRE_TOLERANCE.cm, CENTRE_TOLERANCE.ratio * side)
    const offCentre = off(cx, cm.w) || off(cz, cm.d)
    row(
      'centre',
      'Origin at the centre of the base',
      offCentre ? 'warn' : 'pass',
      offCentre
        ? `The base's centre is ${round1(cx)} cm, ${round1(cz)} cm off the origin (x, z)`
        : 'Centred',
    )
  }

  return rows
}

export const glbPasses = (rows: GlbCheckRow[]) => rows.every((r) => r.status !== 'fail')

// ── Reading a .glb ─────────────────────────────────────────────────────────────

type GltfJson = {
  asset?: { version?: string }
  buffers?: { uri?: string }[]
  images?: { uri?: string; mimeType?: string }[]
  extensionsUsed?: string[]
}

/**
 * The JSON chunk of a binary glTF, after checking its header (magic "glTF", version 2, the
 * declared length, a JSON first chunk). Null when the bytes are not a .glb.
 */
export function readGlbJson(bytes: Uint8Array): GltfJson | null {
  if (bytes.byteLength < 20) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const MAGIC = 0x46546c67 // "glTF"
  const JSON_CHUNK = 0x4e4f534a // "JSON"
  if (view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== 2) return null
  if (view.getUint32(8, true) !== bytes.byteLength) return null
  const chunkLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + chunkLength > bytes.byteLength) return null
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + chunkLength))) as GltfJson
  } catch {
    return null
  }
}

/** Buffers and images that load from outside the file (data: URIs count too: not "embedded"). */
export const externalUrisOf = (json: GltfJson): string[] =>
  [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((item) => item.uri)
    .filter((uri): uri is string => typeof uri === 'string')
    .map((uri) => (uri.startsWith('data:') ? 'an inline data URI' : uri))

/** The validator report's parts the rules read (its JS API returns a plain object). */
export type ValidatorReport = {
  issues: { numErrors: number; numWarnings: number; messages: GlbValidatorMessage[] }
  info?: {
    extensionsUsed?: string[]
    totalTriangleCount?: number
    resources?: {
      pointer: string
      mimeType?: string
      image?: { width?: number; height?: number }
    }[]
  }
}

/** The validator's part of the facts: its issues, triangles, extensions and image sizes. */
export function validatorFacts(report: ValidatorReport) {
  const images = (report.info?.resources ?? []).filter((r) => r.pointer.startsWith('/images/'))
  return {
    validator: {
      errors: report.issues.numErrors,
      warnings: report.issues.numWarnings,
      messages: report.issues.messages,
    },
    triangles: report.info?.totalTriangleCount ?? null,
    extensionsUsed: report.info?.extensionsUsed ?? [],
    textures: images.map((r) => ({
      mimeType: r.mimeType ?? 'unknown',
      width: r.image?.width ?? null,
      height: r.image?.height ?? null,
    })),
  }
}
