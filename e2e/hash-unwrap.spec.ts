import { test, expect } from '@playwright/test'

import { hashUnwrap, unwrapMatches, unwrapStats } from '@/components/scene/bake/hashUnwrap'

test('same float bits → same hash; one ulp or a reorder → a different one', () => {
  const a = new Float32Array([0.1, 0.2, 0.3, 0.4])
  expect(hashUnwrap([a])).toBe(hashUnwrap([new Float32Array(a)]))
  // The next float32 above 0.3 (0.30000001 rounds back to 0.3 itself: the same bits).
  const b = new Float32Array(a)
  b[2] = 0.30000004
  expect(b[2]).not.toBe(a[2])
  expect(hashUnwrap([b])).not.toBe(hashUnwrap([a]))
  expect(hashUnwrap([a, b])).not.toBe(hashUnwrap([b, a]))
})

test('array boundaries count: [a, b] ≠ [a ++ b]; a view hashes its own floats only', () => {
  const a = new Float32Array([0.1, 0.2])
  const b = new Float32Array([0.3, 0.4])
  expect(hashUnwrap([a, b])).not.toBe(hashUnwrap([new Float32Array([0.1, 0.2, 0.3, 0.4])]))
  const whole = new Float32Array([9, 0.3, 0.4, 9])
  expect(hashUnwrap([whole.subarray(1, 3)])).toBe(hashUnwrap([b]))
  expect(hashUnwrap([])).toMatch(/^[0-9a-f]{8}$/)
})

// --- The tolerant check: Safari / Firefox may compute uv1 one ulp apart -------------------------

/** A plausible atlas: 50,000 vertices (100k values) in [0, 1), deterministic. */
const atlas = (): Float32Array => {
  const a = new Float32Array(100_000)
  let seed = 1
  for (let i = 0; i < a.length; i++) {
    seed = (seed * 16807) % 2147483647
    a[i] = seed / 2147483647
  }
  return a
}
const unwrapOf = (arrays: Float32Array[]) => ({
  hash: hashUnwrap(arrays),
  stats: unwrapStats(arrays),
})

test('unwrapStats: [count, Σu, Σv, Σk·u, Σk·v] per array, k = vertex index / count', () => {
  const a = new Float32Array([0.5, 0.25, 1, 0.75])
  const [stat] = unwrapStats([a])
  expect(stat).toEqual([2, 1.5, 1, 0.5, 0.375])
  expect(unwrapStats([a, a])).toHaveLength(2)
})

test('the same unwrap matches exactly', () => {
  const a = atlas()
  expect(unwrapMatches(unwrapOf([a]), unwrapOf([new Float32Array(a)]))).toBe('exact')
})

test('one-ulp noise on a few values matches (tolerant), though the hash differs', () => {
  const a = atlas()
  const b = new Float32Array(a)
  const bits = new Uint32Array(b.buffer)
  for (const i of [3, 777, 4242, 61_000, 99_999]) bits[i]! += 1 // the next float32 up
  expect(b[3]).not.toBe(a[3])
  const stored = unwrapOf([a])
  const local = unwrapOf([b])
  expect(local.hash).not.toBe(stored.hash)
  expect(unwrapMatches(stored, local)).toBe('tolerant')
})

test('a 3-vertex chart shifted half a texel (2048 atlas) does not match', () => {
  const a = atlas()
  const b = new Float32Array(a)
  for (const vertex of [30_000, 30_001, 30_002]) b[vertex * 2]! += 0.5 / 2048
  expect(unwrapMatches(unwrapOf([a]), unwrapOf([b]))).toBe('mismatch')
})

test('two equal-size charts trading places do not match', () => {
  const a = atlas()
  const chartA = [0.1, 0.1, 0.2, 0.1, 0.1, 0.2]
  const chartB = [0.8, 0.8, 0.9, 0.8, 0.8, 0.9]
  a.set(chartA, 2_000) // vertices 1,000–1,002
  a.set(chartB, 80_000) // vertices 40,000–40,002
  const b = new Float32Array(a)
  b.set(chartB, 2_000)
  b.set(chartA, 80_000)
  // Same values, same sums of u and v: only the order tells them apart.
  expect(unwrapStats([b])[0]![1]).toBeCloseTo(unwrapStats([a])[0]![1]!, 9)
  expect(unwrapMatches(unwrapOf([a]), unwrapOf([b]))).toBe('mismatch')
})

test('a different vertex count or number of arrays does not match', () => {
  const a = atlas()
  expect(unwrapMatches(unwrapOf([a]), unwrapOf([a.subarray(0, a.length - 2)]))).toBe('mismatch')
  expect(unwrapMatches(unwrapOf([a]), unwrapOf([a, new Float32Array([0.5, 0.5])]))).toBe('mismatch')
})
