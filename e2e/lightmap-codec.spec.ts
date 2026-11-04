import { test, expect } from '@playwright/test'

import {
  chooseEncoding,
  decodeLightmapPng,
  decodePng16,
  dequantize,
  encodePng16,
  quantize,
} from '@/components/scene/bake/lightmapCodec'

const rgba = (values: ArrayLike<number>): Float32Array =>
  Float32Array.from({ length: values.length * 4 }, (_, i) => (i % 4 === 3 ? 1 : values[i >> 2]!))

test('log16 round trip: <1% above max/1000, tiny absolute error below', () => {
  // 0 to 8, dense near black so the dark corners are covered.
  const values = Array.from({ length: 4000 }, (_, i) => (i < 2000 ? i * 0.00005 : (i / 4000) * 8))
  const v = rgba(values)
  const e = chooseEncoding(v, 'light')
  expect(e.format).toBe('log16')
  const back = dequantize(quantize(v, e), e)
  expect(back.length).toBe(v.length)
  for (let i = 0; i < v.length; i++) {
    if (i % 4 === 3) {
      expect(back[i]).toBe(1)
    } else if (v[i]! > e.max / 1000) {
      expect(Math.abs(back[i]! - v[i]!) / v[i]!).toBeLessThan(0.01)
    } else {
      expect(Math.abs(back[i]! - v[i]!)).toBeLessThanOrEqual(e.knee / 100)
    }
  }
})

test('log16 keeps the brightest texels: one 1.5× the 99.9th percentile round-trips within 1%', () => {
  // A sunlit window reveal: one texel far above the rest of the map.
  const values = Array.from({ length: 10_000 }, (_, i) => 0.1 + (i / 10_000) * 3.9)
  const p999 = values[Math.floor(values.length * 0.999)]!
  const outlier = 1.5 * p999
  values[values.length - 1] = outlier
  const v = rgba(values)
  const e = chooseEncoding(v, 'light')
  expect(e.max).toBeGreaterThanOrEqual(outlier)
  const back = dequantize(quantize(v, e), e)
  let worst = 0
  for (let i = 0; i < v.length; i++) {
    if (i % 4 !== 3) worst = Math.max(worst, Math.abs(back[i]! - v[i]!) / v[i]!)
  }
  expect(worst).toBeLessThan(0.01)
  // The outlier itself, exactly: the brightest texel no longer clamps.
  expect(Math.abs(back[(values.length - 1) * 4]! - outlier) / outlier).toBeLessThan(0.001)
})

test('signed16 keeps direction components to half a step', () => {
  const v = rgba(Array.from({ length: 4097 }, (_, i) => -0.5 + i / 4096))
  const e = chooseEncoding(v, 'direction')
  expect(e.format).toBe('signed16')
  const back = dequantize(quantize(v, e), e)
  for (let i = 0; i < v.length; i++) {
    if (i % 4 !== 3) expect(Math.abs(back[i]! - v[i]!)).toBeLessThanOrEqual(0.5 / 65535 + 1e-6)
  }
})

test('zero stays zero', () => {
  for (const kind of ['light', 'direction'] as const) {
    const e = chooseEncoding(rgba([0.5, 1, 2]), kind)
    const words = quantize(new Float32Array(16), e)
    expect(words.length).toBe(12)
    if (kind === 'light') expect(Array.from(words).every((w) => w === 0)).toBe(true)
  }
  const e = chooseEncoding(rgba([0.5, 1, 2]), 'light')
  expect(Array.from(dequantize(quantize(new Float32Array(4), e), e))).toEqual([0, 0, 0, 1])
})

const sample = (width: number, height: number): Uint16Array =>
  Uint16Array.from({ length: width * height * 3 }, (_, i) => (i * 2654435761) % 65536)

test('PNG round trip is lossless with a valid 16-bit RGB header', async () => {
  const words = sample(7, 5)
  const png = await encodePng16(words, 7, 5)
  expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(String.fromCharCode(...png.slice(12, 16))).toBe('IHDR')
  expect(png[24]).toBe(16) // bit depth
  expect(png[25]).toBe(2) // colour type RGB
  const back = await decodePng16(png)
  expect(back.width).toBe(7)
  expect(back.height).toBe(5)
  expect(Array.from(back.words)).toEqual(Array.from(words))
})

test('PNG decode rejects a bad CRC and a non-16-bit PNG', async () => {
  const png = await encodePng16(sample(3, 2), 3, 2)
  const corrupt = png.slice()
  corrupt[corrupt.length - 20] ^= 0xff // inside IDAT data
  await expect(decodePng16(corrupt)).rejects.toThrow(/CRC/)

  // 8-bit RGB: patch bit depth and fix up the IHDR CRC so only the format is wrong.
  const eight = png.slice()
  eight[24] = 8
  const crc = (await import('node:zlib')).crc32(eight.subarray(12, 29))
  new DataView(eight.buffer).setUint32(29, crc)
  await expect(decodePng16(eight)).rejects.toThrow(/16-bit/)
  await expect(decodePng16(new Uint8Array(20))).rejects.toThrow(/not a PNG/)
})

/** A 16-bit RGB PNG whose rows cycle through all five filter types (encodePng16 writes only Sub). */
const pngWithEveryFilter = async (words: Uint16Array, width: number, height: number) => {
  const { deflateSync, crc32 } = await import('node:zlib')
  const stride = width * 6
  const rows = Array.from({ length: height }, (_, y) => {
    const row = new Uint8Array(stride)
    const view = new DataView(row.buffer)
    for (let i = 0; i < width * 3; i++) view.setUint16(i * 2, words[y * width * 3 + i]!)
    return row
  })
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c
    const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)]
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  const raw = new Uint8Array(height * (stride + 1))
  rows.forEach((row, y) => {
    const filter = y % 5
    const up = rows[y - 1]
    raw[y * (stride + 1)] = filter
    for (let i = 0; i < stride; i++) {
      const a = i >= 6 ? row[i - 6]! : 0
      const b = up ? up[i]! : 0
      const c = up && i >= 6 ? up[i - 6]! : 0
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter]!
      raw[y * (stride + 1) + 1 + i] = (row[i]! - predictor) & 0xff
    }
  })
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    out.set(Buffer.from(type, 'ascii'), 4)
    out.set(data, 8)
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13)
  new DataView(ihdr.buffer).setUint32(0, width)
  new DataView(ihdr.buffer).setUint32(4, height)
  ihdr[8] = 16
  ihdr[9] = 2
  return Buffer.concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

test('PNG decode undoes every filter type, rows split across inflate chunks', async () => {
  // ~180 KB inflated: the stream hands it over in several chunks, cutting through rows.
  const words = sample(300, 50)
  const back = await decodePng16(await pngWithEveryFilter(words, 300, 50))
  expect(back.width).toBe(300)
  expect(back.height).toBe(50)
  expect(Buffer.from(back.words.buffer).equals(Buffer.from(words.buffer))).toBe(true)
})

test('AR-175: the streamed lightmap decode is bit for bit the old decode → flip → dequantize → half', async () => {
  const { DataUtils } = await import('three')
  const width = 300
  const height = 50
  const words = sample(width, height)
  const png = await pngWithEveryFilter(words, width, height)
  const encodings = [
    chooseEncoding(rgba([0, 0.0003, 0.2, 1.7, 9.5]), 'light'),
    chooseEncoding(rgba([0]), 'direction'),
  ]
  for (const encoding of encodings) {
    const map = { receiver: 'wall', kind: 'light', url: 'x', width, height, encoding } as const
    const texture = await decodeLightmapPng(
      png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      map,
    )
    // The old path: whole-image words, rows flipped to bake order, floats, then half floats.
    const flipped = new Uint16Array(words.length)
    for (let y = 0; y < height; y++)
      flipped.set(words.subarray(y * width * 3, (y + 1) * width * 3), (height - 1 - y) * width * 3)
    const floats = dequantize(flipped, encoding)
    const expected = Uint16Array.from(floats, (v) => DataUtils.toHalfFloat(v))
    const data = texture.image.data as Uint16Array
    expect(texture.image.width).toBe(width)
    expect(texture.image.height).toBe(height)
    expect(data.length).toBe(expected.length)
    expect(Buffer.from(data.buffer).equals(Buffer.from(expected.buffer))).toBe(true)
  }
})
