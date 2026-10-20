/**
 * A fingerprint of our own lightmap unwrap: 32-bit FNV-1a over the float BITS of each array, in
 * order, as 8 hex digits. A stored bake's maps fit only the unwrap they were baked into; the
 * room's unwrap is rebuilt on every visit, and a different hash means the maps no longer fit.
 * Each array's length goes in first, so where one ends and the next begins counts too.
 */
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

const mix = (hash: number, word: number) => {
  // The word's four bytes, low byte first (the float's bits whatever the platform's byte order).
  for (let shift = 0; shift < 32; shift += 8) {
    hash ^= (word >>> shift) & 0xff
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash
}

export const hashUnwrap = (arrays: Float32Array[]): string => {
  let hash = FNV_OFFSET
  for (const array of arrays) {
    hash = mix(hash, array.length)
    const bits = new Uint32Array(array.buffer, array.byteOffset, array.length)
    for (let i = 0; i < bits.length; i++) hash = mix(hash, bits[i]!)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * The same unwrap, as numbers a different browser can come close to: Safari and Firefox may
 * compute `uv1` one float32 ulp apart (their own trig), so their hash never equals Chromium's.
 * Per array (the arrays `hashUnwrap` takes, in its order): `[count, Σu, Σv, Σk·u, Σk·v]`, where
 * `count` is the vertex count and `k` = vertex index / count. Σk·u and Σk·v depend on WHERE each
 * value sits, so charts that trade places change them even though Σu and Σv stay put. Summed in
 * float64.
 */
export const unwrapStats = (arrays: Float32Array[]): number[][] =>
  arrays.map((array) => {
    const count = Math.floor(array.length / 2)
    let u = 0
    let v = 0
    let ku = 0
    let kv = 0
    for (let i = 0; i < count; i++) {
      const k = i / count
      u += array[i * 2]!
      v += array[i * 2 + 1]!
      ku += k * array[i * 2]!
      kv += k * array[i * 2 + 1]!
    }
    return [count, u, v, ku, kv]
  })

/** Ulp noise is random: it grows with √count. 1e-6 · √count stays far below half a texel. */
const tolerance = (count: number) => 1e-6 * Math.sqrt(count)

/**
 * Do a stored bake's maps fit the unwrap built here? `exact`: the same hash (the same float bits).
 * `tolerant`: different bits, but the same arrays and vertex counts and every sum within
 * 1e-6 · √count — the same layout computed one ulp apart. Anything else: `mismatch` (a shifted or
 * re-packed chart moves a sum by far more: half a 2048 texel on one 3-vertex chart is 7e-4).
 */
export const unwrapMatches = (
  stored: { hash: string; stats: number[][] },
  local: { hash: string; stats: number[][] },
): 'exact' | 'tolerant' | 'mismatch' => {
  if (stored.hash === local.hash) return 'exact'
  if (stored.stats.length !== local.stats.length) return 'mismatch'
  for (let a = 0; a < stored.stats.length; a++) {
    const s = stored.stats[a]!
    const l = local.stats[a]!
    if (s.length !== 5 || l.length !== 5 || s[0] !== l[0]) return 'mismatch'
    const tau = tolerance(s[0]!)
    for (let i = 1; i < 5; i++) if (!(Math.abs(s[i]! - l[i]!) <= tau)) return 'mismatch'
  }
  return 'tolerant'
}
