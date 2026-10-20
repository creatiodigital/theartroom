import { Loader } from 'three'
import type { DataTexture } from 'three'

import type { BakeMap } from '@/lib/bake/bakeRecord'

import { decodeLightmapPng } from './lightmapCodec'

/**
 * A map download that receives nothing — no response, then no bytes — for this long is given up:
 * the load fails, and the room falls back to today's look instead of waiting behind the loader.
 * A slow download that keeps receiving bytes is never cut.
 */
export const LIGHTMAP_STALL_MS = 30_000

/** `fetch` + the whole body, aborted when nothing arrives for `stallMs` (see LIGHTMAP_STALL_MS). */
async function fetchBytes(url: string, init: RequestInit, stallMs: number): Promise<ArrayBuffer> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = () => {
    clearTimeout(timer)
    timer = setTimeout(
      () => controller.abort(new Error(`stalled: nothing received for ${stallMs / 1000} s`)),
      stallMs,
    )
  }
  arm()
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    if (!response.body) return await response.arrayBuffer()
    arm()
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      length += value.byteLength
      arm()
    }
    const bytes = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes.buffer
  } finally {
    clearTimeout(timer)
  }
}

/**
 * ⚠️ AR-161 — a stored bake's lightmap: fetch its 16-bit PNG, decode it to a half-float texture
 * (`decodeLightmapPng`). A three `Loader`, so r3f's `useLoader` suspends on it inside the scene's
 * `<Suspense>` and the loading manager (drei's `useProgress`, the monogram loader) counts each map
 * like any other asset. A stalled download fails like any other (`LIGHTMAP_STALL_MS`).
 *
 * A map's URL does not say how its pixels are encoded: `describe` hands the loader the bake's map
 * records first (the extensions argument of `useLoader`). Every bake has new file names, so a URL
 * always means the same file and encoding.
 */
export class LightmapLoader extends Loader<DataTexture> {
  private maps = new Map<string, BakeMap>()

  describe(maps: BakeMap[]): this {
    for (const map of maps) this.maps.set(map.url, map)
    return this
  }

  load(
    url: string,
    onLoad: (texture: DataTexture) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ): void {
    const map = this.maps.get(url)
    const resolved = this.manager.resolveURL(this.path + url)
    this.manager.itemStart(resolved)
    const fail = (error: unknown) => {
      onError?.(error)
      this.manager.itemError(resolved)
      this.manager.itemEnd(resolved)
    }
    if (!map) {
      fail(new Error(`LightmapLoader: no map record for ${url}`))
      return
    }
    fetchBytes(
      resolved,
      {
        headers: this.requestHeader,
        credentials: this.withCredentials ? 'include' : 'same-origin',
      },
      LIGHTMAP_STALL_MS,
    )
      .then((buffer) => decodeLightmapPng(buffer, map))
      .then((texture) => {
        onLoad(texture)
        this.manager.itemEnd(resolved)
      })
      .catch(fail)
  }
}
