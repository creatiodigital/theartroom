import type { Color, Mesh } from 'three'

import { BAKER_VERSION, type BakeDraft, type BakeMap } from '@/lib/bake/bakeRecord'
import { bakeMapFile } from '@/lib/bake/bakeUpload'
import type { SpaceCamera } from '@/lib/bake/spaceLooks'

import { artLightRecord } from './applyBake'
import type { LightBaker } from './LightBaker'
import { encodeLightmapPng } from './lightmapCodec'

/**
 * ⚠️ AR-161 — a finished bake as files and a record: what the admin's bake stores (`BakeRunner`),
 * so a stored bake is exactly the bake that ran.
 */

export interface EncodedBakeMap {
  /** Its file name in the bake's folder. */
  file: string
  /** The record's entry for it, all but where it is stored. */
  map: Omit<BakeMap, 'url'>
  blob: Blob
  /** Values above the encoding's range (log16 spans the map's peak: none). */
  clamped: number
  /** The map's peak over the encoding's max. */
  peak: number
}

/**
 * Every map of a finished bake, read back from the GPU and encoded to its 16-bit PNG, one after
 * the other (`onMap` after each). `signal`: stop between maps once the page has gone away.
 */
export const encodeBakeMaps = async (
  baker: LightBaker,
  onMap?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ maps: EncodedBakeMap[]; exportMs: number; encodeMs: number }> => {
  const t0 = performance.now()
  const exported = baker.exportMaps()
  const t1 = performance.now()
  const maps: EncodedBakeMap[] = []
  for (const m of exported) {
    signal?.throwIfAborted()
    const { blob, encoding } = await encodeLightmapPng(m.pixels, m.width, m.height, m.kind)
    let clamped = 0
    let peak = 0
    for (let i = 0; i < m.pixels.length; i++) {
      if (i % 4 === 3) continue
      peak = Math.max(peak, m.pixels[i]!)
      if (encoding.format === 'log16' && m.pixels[i]! > encoding.max) clamped++
    }
    maps.push({
      file: bakeMapFile(m.receiver, m.kind),
      map: { receiver: m.receiver, kind: m.kind, width: m.width, height: m.height, encoding },
      blob,
      clamped,
      peak: peak / encoding.max,
    })
    onMap?.(maps.length, exported.length)
  }
  return {
    maps,
    exportMs: Math.round(t1 - t0),
    encodeMs: Math.round(performance.now() - t1),
  }
}

/**
 * The record of a bake, as the admin's page sends it (the server adds `bakedBy` and
 * `reviewedAt`). `artBounce`: the light the bake measured at each artwork image, stored by
 * artwork id; `camera`: the space's fixed camera at bake time.
 */
export const buildBakeDraft = ({
  id,
  fingerprint,
  unwrap,
  maps,
  artBounce,
  camera,
  ms,
}: {
  id: string
  fingerprint: string
  unwrap: { hash: string; stats: number[][] }
  maps: BakeMap[]
  artBounce: Map<Mesh, Color>
  camera: SpaceCamera
  ms: number
}): BakeDraft => ({
  id,
  fingerprint,
  bakerVersion: BAKER_VERSION,
  unwrapHash: unwrap.hash,
  unwrapStats: unwrap.stats,
  maps,
  camera: { exposure: camera.exposure, whiteBalance: [...camera.whiteBalance] },
  artLight: artLightRecord(artBounce),
  bakedAt: new Date().toISOString(),
  ms,
})
