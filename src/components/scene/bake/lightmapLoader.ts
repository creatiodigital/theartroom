import { useSyncExternalStore } from 'react'
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

/**
 * The bytes each map download has received, by URL, for the visit page's loader: the maps are the
 * biggest files of a baked room (tens of MB), and the loading manager counts each as one item, so
 * by items alone the loader would stand still while they arrive. A tiny external store.
 */
type Received = { loaded: number; total: number | null; done: boolean }
const received = new Map<string, Received>()
const listeners = new Set<() => void>()
let version = 0
let lastEmit = 0
/** At most one loader update per this many ms while bytes stream in. */
const EMIT_MS = 100

const emit = (force: boolean) => {
  const now = Date.now()
  if (!force && now - lastEmit < EMIT_MS) return
  lastEmit = now
  version++
  listeners.forEach((listener) => listener())
}

const note = (url: string, next: Received, force = false) => {
  received.set(url, next)
  emit(force)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 0..1: how much of these maps has arrived — by bytes once every size is known, by the average
 * per map before that. A map not started yet counts as nothing.
 */
export const lightmapBytesFraction = (urls: readonly string[]): number => {
  if (!urls.length) return 1
  const all = urls.map((url) => received.get(url))
  if (all.every((r) => r && (r.done || r.total))) {
    let loaded = 0
    let total = 0
    for (const r of all) {
      const size = r!.total ?? r!.loaded
      total += size
      loaded += r!.done ? size : Math.min(r!.loaded, size)
    }
    return total > 0 ? loaded / total : 1
  }
  let sum = 0
  for (const r of all) sum += !r ? 0 : r.done ? 1 : r.total ? Math.min(1, r.loaded / r.total) : 0
  return sum / urls.length
}

/** `lightmapBytesFraction`, re-read as bytes arrive. */
export const useLightmapBytes = (urls: readonly string[]): number => {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
  return lightmapBytesFraction(urls)
}

/** `fetch` + the whole body, aborted when nothing arrives for `stallMs` (see LIGHTMAP_STALL_MS). */
async function fetchBytes(
  url: string,
  init: RequestInit,
  stallMs: number,
  onBytes: (loaded: number, total: number | null) => void = () => {},
): Promise<ArrayBuffer> {
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
    const size = Number(response.headers.get('content-length'))
    const total = Number.isFinite(size) && size > 0 ? size : null
    onBytes(0, total)
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
      onBytes(length, total)
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
 * like any other asset; its bytes as they arrive go to `useLightmapBytes`. A stalled download fails
 * like any other (`LIGHTMAP_STALL_MS`).
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
    note(url, { loaded: 0, total: null, done: false }, true)
    fetchBytes(
      resolved,
      {
        headers: this.requestHeader,
        credentials: this.withCredentials ? 'include' : 'same-origin',
      },
      LIGHTMAP_STALL_MS,
      (loaded, total) => note(url, { loaded, total, done: false }),
    )
      .then((buffer) => {
        note(url, { loaded: buffer.byteLength, total: buffer.byteLength, done: true }, true)
        return decodeLightmapPng(buffer, map)
      })
      .then((texture) => {
        onLoad(texture)
        this.manager.itemEnd(resolved)
      })
      .catch(fail)
  }
}
