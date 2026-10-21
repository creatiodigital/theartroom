import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RGBAFormat } from 'three'

import type { BakeMap, BakeMapKind, LightmapEncoding } from '@/lib/bake/bakeRecord'

/**
 * AR-161 — lightmap PNG codec. A baked lightmap is linear HDR float; it is stored as a 16-bit RGB
 * PNG that keeps the range: `log16` (light, a log curve with a linear knee near black) and
 * `signed16` (direction, components in [-0.5, 0.5]). Canvas only writes 8-bit PNGs, so the PNG
 * itself is written and read here. Decoding returns a half-float texture for visitors.
 */

// signed16 has no range to fit: these two fields are fixed so the stored encoding stays well formed.
const SIGNED_MAX = 0.5
const SIGNED_KNEE = 0

const WORD = 65535
const KNEE_DIVISOR = 4096
const MIN_MAX = 1e-4 // an all-black map still needs a finite curve

/**
 * The encoding that fits a map: log16 spans up to the map's brightest value, so nothing clamps.
 * The log curve's steps are ~0.013% of the value across the whole range, so a few very bright
 * texels (a sunlit window reveal) cost the rest of the map nothing.
 */
export function chooseEncoding(pixels: Float32Array, kind: BakeMapKind): LightmapEncoding {
  if (kind === 'direction') return { format: 'signed16', max: SIGNED_MAX, knee: SIGNED_KNEE }
  let peak = 0
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]!
    if (i % 4 !== 3 && Number.isFinite(v) && v > peak) peak = v
  }
  const max = Math.max(MIN_MAX, peak)
  return { format: 'log16', max, knee: max / KNEE_DIVISOR }
}

/** RGBA float to RGB 16-bit words (3 per pixel; the alpha is dropped). */
export function quantize(pixels: Float32Array, encoding: LightmapEncoding): Uint16Array {
  const count = Math.floor(pixels.length / 4)
  const out = new Uint16Array(count * 3)
  const { format, max, knee } = encoding
  const scale = WORD / Math.log(1 + max / knee)
  for (let p = 0; p < count; p++) {
    for (let c = 0; c < 3; c++) {
      const v = pixels[p * 4 + c]!
      const w =
        format === 'signed16' ? (v + 0.5) * WORD : Math.log(1 + Math.max(0, v) / knee) * scale
      out[p * 3 + c] = Math.min(WORD, Math.max(0, Math.round(w)))
    }
  }
  return out
}

/** RGB 16-bit words back to RGBA float (alpha 1). */
export function dequantize(words: Uint16Array, encoding: LightmapEncoding): Float32Array {
  const count = Math.floor(words.length / 3)
  const out = new Float32Array(count * 4)
  const { format, max, knee } = encoding
  const inv = Math.log(1 + max / knee) / WORD
  for (let p = 0; p < count; p++) {
    for (let c = 0; c < 3; c++) {
      const w = words[p * 3 + c]!
      out[p * 4 + c] = format === 'signed16' ? w / WORD - 0.5 : knee * (Math.exp(w * inv) - 1)
    }
    out[p * 4 + 3] = 1
  }
  return out
}

// --- Minimal 16-bit RGB PNG ---

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const BPP = 6 // bytes per pixel: 3 samples x 2 bytes

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const pipe = async (
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> => {
  const source = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream()
  return new Uint8Array(await new Response(source.pipeThrough(stream)).arrayBuffer())
}

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** 16-bit RGB words (row 0 = top of the image) to PNG bytes, every row "Sub" filtered. */
export async function encodePng16(
  words: Uint16Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  if (words.length !== width * height * 3) throw new Error('encodePng16: size mismatch')
  const stride = width * BPP
  const raw = new Uint8Array(height * (stride + 1))
  const row = new Uint8Array(stride)
  const rowView = new DataView(row.buffer)
  for (let y = 0; y < height; y++) {
    for (let i = 0; i < width * 3; i++) rowView.setUint16(i * 2, words[y * width * 3 + i]!)
    const o = y * (stride + 1)
    raw[o] = 1
    for (let i = 0; i < stride; i++)
      raw[o + 1 + i] = (row[i]! - (i >= BPP ? row[i - BPP]! : 0)) & 0xff
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  ihdr[8] = 16 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const idat = await pipe(raw, new CompressionStream('deflate'))
  const parts = [
    Uint8Array.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** PNG bytes (16-bit RGB, non-interlaced, any filters) to words. Anything else throws. */
export async function decodePng16(
  bytes: Uint8Array,
): Promise<{ width: number; height: number; words: Uint16Array }> {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) {
    throw new Error('decodePng16: not a PNG')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0
  let height = 0
  let sawHeader = false
  let sawEnd = false
  const idats: Uint8Array[] = []
  let at = 8
  while (at < bytes.length && !sawEnd) {
    if (at + 12 > bytes.length) throw new Error('decodePng16: truncated PNG')
    const length = view.getUint32(at)
    if (at + 12 + length > bytes.length) throw new Error('decodePng16: truncated PNG')
    const body = bytes.subarray(at + 8, at + 8 + length)
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== view.getUint32(at + 8 + length)) {
      throw new Error('decodePng16: bad chunk CRC')
    }
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8))
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('decodePng16: bad IHDR')
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      if (body[8] !== 16 || body[9] !== 2)
        throw new Error('decodePng16: only 16-bit RGB PNGs are supported')
      if (body[10] !== 0 || body[11] !== 0 || body[12] !== 0) {
        throw new Error('decodePng16: unsupported compression, filter method or interlacing')
      }
      sawHeader = true
    } else if (type === 'IDAT') {
      idats.push(body)
    } else if (type === 'IEND') {
      sawEnd = true
    }
    at += 12 + length
  }
  if (!sawHeader || !idats.length || !sawEnd || !width || !height) {
    throw new Error('decodePng16: incomplete PNG')
  }
  const joined = new Uint8Array(idats.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of idats) {
    joined.set(p, o)
    o += p.length
  }
  const raw = await pipe(joined, new DecompressionStream('deflate'))
  const stride = width * BPP
  if (raw.length !== height * (stride + 1)) throw new Error('decodePng16: bad image data size')
  const pixels = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!
    if (filter > 4) throw new Error('decodePng16: bad filter type')
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]!
      const a = i >= BPP ? pixels[y * stride + i - BPP]! : 0
      const b = y > 0 ? pixels[(y - 1) * stride + i]! : 0
      const c = y > 0 && i >= BPP ? pixels[(y - 1) * stride + i - BPP]! : 0
      const add =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? (a + b) >> 1
                : paeth(a, b, c)
      pixels[y * stride + i] = (x + add) & 0xff
    }
  }
  const out = new Uint16Array(width * height * 3)
  const px = new DataView(pixels.buffer)
  for (let i = 0; i < out.length; i++) out[i] = px.getUint16(i * 2)
  return { width, height, words: out }
}

const flipRows = <T extends Uint16Array | Float32Array>(
  data: T,
  rowLength: number,
  height: number,
): T => {
  const out = data.slice() as T
  for (let y = 0; y < height; y++) {
    out.set(data.subarray(y * rowLength, (y + 1) * rowLength), (height - 1 - y) * rowLength)
  }
  return out
}

/** Float RGBA (bake row order, row 0 at the bottom) to an image-order 16-bit PNG. */
export async function encodeLightmapPng(
  pixels: Float32Array,
  width: number,
  height: number,
  kind: BakeMapKind,
): Promise<{ blob: Blob; encoding: LightmapEncoding }> {
  const encoding = chooseEncoding(pixels, kind)
  const words = flipRows(quantize(pixels, encoding), width * 3, height)
  const png = await encodePng16(words, width, height)
  return { blob: new Blob([png as Uint8Array<ArrayBuffer>], { type: 'image/png' }), encoding }
}

/**
 * PNG to a half-float texture. Rows are flipped back to bake order here, so the texture is
 * uploaded with `flipY = false` and matches the baked targets. The caller sets `channel`.
 */
export async function decodeLightmapPng(buffer: ArrayBuffer, map: BakeMap): Promise<DataTexture> {
  const { width, height, words } = await decodePng16(new Uint8Array(buffer))
  const floats = dequantize(flipRows(words, width * 3, height), map.encoding)
  const half = new Uint16Array(floats.length)
  for (let i = 0; i < floats.length; i++) half[i] = DataUtils.toHalfFloat(floats[i]!)
  const texture = new DataTexture(half, width, height, RGBAFormat, HalfFloatType)
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.flipY = false
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}
