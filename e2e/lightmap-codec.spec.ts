import { test, expect } from '@playwright/test'

import {
  chooseEncoding,
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
