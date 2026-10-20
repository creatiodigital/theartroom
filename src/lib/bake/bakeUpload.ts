import {
  isBakeRecord,
  type BakeDraft,
  type BakeMapKind,
  type BakeRecord,
  type BakeSurface,
} from './bakeRecord'

/**
 * AR-161 — how the admin's browser stores a finished bake: every map file uploaded straight to
 * storage (`POST …/bake/uploads` mints the bake id and one upload URL per file), then the record
 * saved (`PUT …/bake`). All or nothing: the record is sent only after every file is stored, and
 * never once the page has gone away — a failure anywhere before saves nothing, and the draft
 * bake the exhibition had stays as it was. Pure (fetch only), so it runs in Node tests too.
 */

/**
 * Bake files never change: every bake has a new id, so a key is never reused — cached for a
 * year. R2 signs it into the presigned PUT (`bakeStorage`); the local backend serves it.
 */
export const BAKE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/** A map's file name in its bake's folder (the server accepts `^[a-z-]+\.png$`). */
export const bakeMapFile = (receiver: BakeSurface, kind: BakeMapKind) => `${receiver}-${kind}.png`

/**
 * The headers a bake file's PUT sends to `url`: always its type. An upload URL on another
 * origin is an R2 presigned PUT, which signs the cache header too — it must be sent, exactly.
 * The local backend (development) is on this origin and sets its own.
 */
export const bakeUploadHeaders = (url: string, origin: string): Record<string, string> =>
  new URL(url, origin).origin === new URL(origin).origin
    ? { 'Content-Type': 'image/png' }
    : { 'Content-Type': 'image/png', 'Cache-Control': BAKE_CACHE_CONTROL }

export interface BakeFile {
  file: string
  blob: Blob
}

export interface SaveBakeOptions {
  exhibitionId: string
  files: BakeFile[]
  /** The record to save, once the server has minted the bake id and each file's public URL. */
  record: (bakeId: string, publicUrls: Record<string, string>) => BakeDraft
  /** This page's origin: an upload URL anywhere else is a presigned R2 PUT. */
  origin: string
  /** Aborted when the page goes away: nothing more is sent, the record least of all. */
  signal?: AbortSignal
  /** 0..1, never backwards; 1 only once the record is saved. */
  onProgress?: (fraction: number) => void
  fetch?: typeof fetch
}

/** The uploads' share of the progress; saving the record is the rest. */
const UPLOAD_SHARE = 0.95

const refused = async (response: Response, what: string) => {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  const reason = typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`
  return new Error(`${what}: ${reason}`)
}

/** Uploads every file, then saves the record (the server adds `bakedBy`); returns the saved bake. */
export const saveBake = async ({
  exhibitionId,
  files,
  record,
  origin,
  signal,
  onProgress,
  fetch: fetchImpl = fetch,
}: SaveBakeOptions): Promise<BakeRecord> => {
  const route = `/api/exhibitions/${encodeURIComponent(exhibitionId)}/bake`
  const json = { 'Content-Type': 'application/json' }

  const started = await fetchImpl(`${route}/uploads`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ files: files.map((f) => f.file) }),
    signal,
  })
  if (!started.ok) throw await refused(started, 'The upload could not start')
  const { bakeId, uploads } = (await started.json()) as {
    bakeId?: unknown
    uploads?: { file: string; url: string; publicUrl: string }[]
  }
  const byFile = new Map((uploads ?? []).map((u) => [u.file, u]))
  const missing = files.filter((f) => !byFile.has(f.file)).map((f) => f.file)
  if (typeof bakeId !== 'string' || missing.length) {
    throw new Error(`No upload URL for ${missing.join(', ') || 'this bake'}`)
  }

  // In parallel; the first failure stops the rest (and the page going away stops them all).
  const uploading = new AbortController()
  const stop = () => uploading.abort(signal?.reason)
  signal?.addEventListener('abort', stop)
  const total = files.reduce((n, f) => n + f.blob.size, 0)
  let sent = 0
  onProgress?.(0)
  try {
    await Promise.all(
      files.map(async ({ file, blob }) => {
        const { url } = byFile.get(file)!
        const response = await fetchImpl(url, {
          method: 'PUT',
          headers: bakeUploadHeaders(url, origin),
          body: blob,
          signal: uploading.signal,
        })
        if (!response.ok) throw new Error(`The upload of ${file} failed (HTTP ${response.status})`)
        sent += blob.size
        onProgress?.(UPLOAD_SHARE * (total > 0 ? sent / total : 1))
      }),
    )
  } catch (error) {
    uploading.abort()
    throw error
  } finally {
    signal?.removeEventListener('abort', stop)
  }

  // Every file is stored. The record goes only while the page is still here.
  signal?.throwIfAborted()
  const publicUrls = Object.fromEntries(files.map((f) => [f.file, byFile.get(f.file)!.publicUrl]))
  const response = await fetchImpl(route, {
    method: 'PUT',
    headers: json,
    body: JSON.stringify(record(bakeId, publicUrls)),
    signal,
  })
  if (!response.ok) throw await refused(response, 'The bake was not saved')
  const saved: unknown = await response.json()
  if (!isBakeRecord(saved)) throw new Error('The bake was not saved: unexpected answer')
  onProgress?.(1)
  return saved
}
