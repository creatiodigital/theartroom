// Local backend only (BAKE_STORAGE=local, never production). Its paths are
// dynamic, so each fs call carries `turbopackIgnore`: without it the build
// traces the whole project — public/ included — into every function that
// imports this module.
import { mkdir, readFile, rm, rmdir, stat, writeFile } from 'fs/promises'
import path from 'path'

import { bakeBackend } from '@/lib/bake/bakeStorage'
import { BAKE_CACHE_CONTROL } from '@/lib/bake/bakeUpload'
import {
  R2_ENV_PREFIXES,
  buildPresentationFileKey,
  deleteR2KeyDirect,
  getPresignedUploadUrl,
  getR2ObjectSize,
  listAllR2Keys,
  publicUrlForKey,
} from '@/lib/r2'

import {
  PHOTO_VIEWS,
  PHOTO_WIDTH_PX,
  PRESENTATION_WIDTH_PX,
  RENDER_ID,
  type PhotoViewKind,
  type PresentationSize,
  type PrintPresentationRecord,
} from './record'

/**
 * Where print presentations live — the same two backends as room bakes (`BAKE_STORAGE`):
 *
 * - `r2` (default): presigned PUTs straight to the bucket, served from its public URL, under
 *   `{env}/presentations/{artworkId}/`:
 *   - the framed render: `{fingerprint}-{renderId}-{1800|900}.webp` (renders saved before
 *     2026-11-20, without a render id: `{fingerprint}-{1800|900}.webp`);
 *   - its photos: `{viewsFingerprint}-{renderId}-{sheet|close|edge}-{2400|600}.webp`.
 *   Every render has its own id, so a file is never overwritten — even a re-render after a sale,
 *   which keeps both fingerprints — and is cached for a year, like bakes.
 * - `local`: development only. Files sit under `.presentation-files/` at the repo root and are
 *   served by `/api/presentation-files/[...key]`, laid out the same way (minus the env prefix).
 */

const SIZES: PresentationSize[] = ['large', 'small']
const LOCAL_URL_ROOT = '/api/presentation-files'
const LOCAL_ROOT = path.join(process.cwd(), '.presentation-files')

/** An artwork id as a single path segment: no dots, slashes or backslashes. */
const ARTWORK_SEGMENT = /^[A-Za-z0-9_-]+$/
/** `presentationInputs(...).fingerprint`: 8 hex digits. */
export const PRESENTATION_FINGERPRINT = /^[0-9a-f]{8}$/
const FILE_PATTERN =
  /^(?:[0-9a-f]{8}(?:-[0-9a-f]{8})?-(?:1800|900)|[0-9a-f]{8}-[0-9a-f]{8}-(?:sheet|close|edge)-(?:2400|600))\.webp$/

function assertSegments(artworkId: string, fingerprint: string, renderId?: string) {
  if (
    !ARTWORK_SEGMENT.test(artworkId) ||
    !PRESENTATION_FINGERPRINT.test(fingerprint) ||
    (renderId !== undefined && !RENDER_ID.test(renderId))
  ) {
    throw new Error('Invalid presentation path segment')
  }
}

/** A new render's id: 8 random hex digits. */
export function newRenderId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function assertLocalAllowed() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    throw new Error('Local presentation storage is development-only')
  }
}

const fileName = (fingerprint: string, size: PresentationSize, renderId?: string) =>
  renderId
    ? `${fingerprint}-${renderId}-${PRESENTATION_WIDTH_PX[size]}.webp`
    : `${fingerprint}-${PRESENTATION_WIDTH_PX[size]}.webp`

const photoFileName = (
  viewsFingerprint: string,
  renderId: string,
  view: PhotoViewKind,
  size: PresentationSize,
) => `${viewsFingerprint}-${renderId}-${view}-${PHOTO_WIDTH_PX[size]}.webp`

/** Where a file is served from on this deployment's backend (or, for R2, `env`'s folder). */
const fileUrl = (artworkId: string, name: string, env?: (typeof R2_ENV_PREFIXES)[number]) =>
  bakeBackend() === 'local' && !env
    ? `${LOCAL_URL_ROOT}/presentations/${artworkId}/${name}`
    : publicUrlForKey(buildPresentationFileKey(artworkId, name, env))

/**
 * The public URLs a render of `fingerprint` is stored at: under `renderId`'s names, or, without
 * one, the names renders had before 2026-11-20.
 */
export function presentationPublicUrls(
  artworkId: string,
  fingerprint: string,
  renderId?: string,
): Record<PresentationSize, string> {
  assertSegments(artworkId, fingerprint, renderId)
  return {
    large: fileUrl(artworkId, fileName(fingerprint, 'large', renderId)),
    small: fileUrl(artworkId, fileName(fingerprint, 'small', renderId)),
  }
}

/** The public URLs a render's photos are stored at, view by view. */
export function photoPublicUrls(
  artworkId: string,
  viewsFingerprint: string,
  renderId: string,
  env?: (typeof R2_ENV_PREFIXES)[number],
): Record<PhotoViewKind, Record<PresentationSize, string>> {
  assertSegments(artworkId, viewsFingerprint, renderId)
  const urls = {} as Record<PhotoViewKind, Record<PresentationSize, string>>
  for (const view of PHOTO_VIEWS) {
    urls[view] = {
      large: fileUrl(artworkId, photoFileName(viewsFingerprint, renderId, view, 'large'), env),
      small: fileUrl(artworkId, photoFileName(viewsFingerprint, renderId, view, 'small'), env),
    }
  }
  return urls
}

/**
 * Whether a stored render's files load on this deployment's pages, whichever environment stored
 * them (owner, 2026-11-10: pointed at production's data, a local server must show exactly what
 * production shows). Every environment's R2 files sit on the bucket's one public host, so they
 * load anywhere; local-backend files exist only on the machine that rendered them.
 */
export function presentationFilesLoadHere(
  artworkId: string,
  record: PrintPresentationRecord,
): boolean {
  const { fingerprint, urls, renderId } = record
  const matches = (url: (size: PresentationSize) => string) =>
    urls.large === url('large') && urls.small === url('small')
  try {
    const own = presentationPublicUrls(artworkId, fingerprint, renderId)
    if (matches((size) => own[size])) return true
    return R2_ENV_PREFIXES.some((env) =>
      matches((size) => fileUrl(artworkId, fileName(fingerprint, size, renderId), env)),
    )
  } catch {
    return false
  }
}

/**
 * Whether a stored render's PHOTOS load on this deployment's pages: they exist, under their own
 * names on this backend or on any environment's R2 folder (as `presentationFilesLoadHere`).
 */
export function photoFilesLoadHere(artworkId: string, record: PrintPresentationRecord): boolean {
  const { views, renderId } = record
  if (!views || !renderId) return false
  const same = (a: Record<PhotoViewKind, Record<PresentationSize, string>>) =>
    PHOTO_VIEWS.every(
      (view) => views.urls[view].large === a[view].large && views.urls[view].small === a[view].small,
    )
  try {
    if (same(photoPublicUrls(artworkId, views.fingerprint, renderId))) return true
    return R2_ENV_PREFIXES.some((env) =>
      same(photoPublicUrls(artworkId, views.fingerprint, renderId, env)),
    )
  } catch {
    return false
  }
}

type Upload = { url: string; publicUrl: string }

/** One file's upload: a presigned R2 PUT, or the local route (which is also where it's served). */
async function uploadFor(artworkId: string, name: string): Promise<Upload> {
  const publicUrl = fileUrl(artworkId, name)
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    return { url: publicUrl, publicUrl }
  }
  const url = await getPresignedUploadUrl(
    buildPresentationFileKey(artworkId, name),
    'image/webp',
    3600,
    BAKE_CACHE_CONTROL,
  )
  return { url, publicUrl }
}

/** One upload URL per size of the framed render, and where each is served. */
export async function createPresentationUploads(
  artworkId: string,
  fingerprint: string,
  renderId?: string,
): Promise<Record<PresentationSize, Upload>> {
  assertSegments(artworkId, fingerprint, renderId)
  const [large, small] = await Promise.all(
    SIZES.map((size) => uploadFor(artworkId, fileName(fingerprint, size, renderId))),
  )
  return { large, small }
}

/** One upload URL per photo view and size, and where each is served. */
export async function createPhotoUploads(
  artworkId: string,
  viewsFingerprint: string,
  renderId: string,
): Promise<Record<PhotoViewKind, Record<PresentationSize, Upload>>> {
  assertSegments(artworkId, viewsFingerprint, renderId)
  const entries = await Promise.all(
    PHOTO_VIEWS.map(async (view) => {
      const [large, small] = await Promise.all(
        SIZES.map((size) =>
          uploadFor(artworkId, photoFileName(viewsFingerprint, renderId, view, size)),
        ),
      )
      return [view, { large, small }] as const
    }),
  )
  return Object.fromEntries(entries) as Record<PhotoViewKind, Record<PresentationSize, Upload>>
}

/** Resolves a local route key to a path inside `.presentation-files/`, or null. */
export function localPresentationPath(key: string[]): string | null {
  if (key.length !== 3) return null
  const [presentations, artworkId, file] = key
  if (presentations !== 'presentations' || !ARTWORK_SEGMENT.test(artworkId)) return null
  if (!FILE_PATTERN.test(file)) return null
  const resolved = path.resolve(LOCAL_ROOT, artworkId, file)
  return resolved.startsWith(LOCAL_ROOT + path.sep) ? resolved : null
}

export async function writeLocalPresentationFile(filePath: string, bytes: Buffer): Promise<void> {
  assertLocalAllowed()
  await mkdir(/*turbopackIgnore: true*/ path.dirname(filePath), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ filePath, bytes)
}

export async function readLocalPresentationFile(filePath: string): Promise<Buffer | null> {
  assertLocalAllowed()
  try {
    return await readFile(/*turbopackIgnore: true*/ filePath)
  } catch {
    return null
  }
}

/** Byte size of a stored file, or null when it isn't there. */
async function fileSize(artworkId: string, name: string): Promise<number | null> {
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    try {
      return (await stat(/*turbopackIgnore: true*/ path.join(LOCAL_ROOT, artworkId, name))).size
    } catch {
      return null
    }
  }
  return getR2ObjectSize(buildPresentationFileKey(artworkId, name))
}

/** Byte size of a stored framed render, or null when it isn't there. */
export async function presentationObjectSize(
  artworkId: string,
  fingerprint: string,
  size: PresentationSize,
  renderId?: string,
): Promise<number | null> {
  assertSegments(artworkId, fingerprint, renderId)
  return fileSize(artworkId, fileName(fingerprint, size, renderId))
}

/** Whether every file of a render — the framed one's two sizes, each photo's two — is stored. */
export async function storedRenderComplete(
  artworkId: string,
  fingerprint: string,
  renderId: string,
  viewsFingerprint: string,
): Promise<boolean> {
  assertSegments(artworkId, fingerprint, renderId)
  assertSegments(artworkId, viewsFingerprint, renderId)
  const names = [
    ...SIZES.map((size) => fileName(fingerprint, size, renderId)),
    ...PHOTO_VIEWS.flatMap((view) =>
      SIZES.map((size) => photoFileName(viewsFingerprint, renderId, view, size)),
    ),
  ]
  const sizes = await Promise.all(names.map((name) => fileSize(artworkId, name)))
  return sizes.every((size) => !!size)
}

/** Every file name a stored render has: its framed sizes and, if it has them, its photos. */
function recordFileNames(record: PrintPresentationRecord): string[] {
  const { fingerprint, renderId, views } = record
  const names = SIZES.map((size) => fileName(fingerprint, size, renderId))
  if (views && renderId && PRESENTATION_FINGERPRINT.test(views.fingerprint)) {
    for (const view of PHOTO_VIEWS) {
      for (const size of SIZES) names.push(photoFileName(views.fingerprint, renderId, view, size))
    }
  }
  return names
}

/** Removes every file of a stored render (framed and photos). Missing files are fine. */
export async function deletePresentationFiles(
  record: PrintPresentationRecord,
  artworkId: string,
): Promise<void> {
  if (!PRESENTATION_FINGERPRINT.test(record.fingerprint)) return
  if (record.renderId !== undefined && !RENDER_ID.test(record.renderId)) return
  assertSegments(artworkId, record.fingerprint, record.renderId)
  const names = recordFileNames(record)
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    await Promise.all(
      names.map((name) =>
        rm(/*turbopackIgnore: true*/ path.join(LOCAL_ROOT, artworkId, name), { force: true }),
      ),
    )
    // Drop the artwork's folder once its last render is gone (fails harmlessly if not empty).
    await rmdir(/*turbopackIgnore: true*/ path.join(LOCAL_ROOT, artworkId)).catch(() => {})
    return
  }
  await Promise.all(
    names.map((name) => deleteR2KeyDirect(buildPresentationFileKey(artworkId, name))),
  )
}

/**
 * Removes an artwork's whole render folder, for an artwork deleted for good: every render it ever
 * stored, the current one's files and whatever failed or replaced renders left behind. This
 * environment's folder only (`{env}/presentations/{artworkId}/` on R2), never another's.
 */
export async function deleteArtworkPresentationFolder(artworkId: string): Promise<void> {
  if (!ARTWORK_SEGMENT.test(artworkId)) throw new Error('Invalid presentation path segment')
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    await rm(/*turbopackIgnore: true*/ path.join(LOCAL_ROOT, artworkId), {
      recursive: true,
      force: true,
    })
    return
  }
  // The trailing slash keeps one id from matching another that starts with it.
  const keys = await listAllR2Keys(buildPresentationFileKey(artworkId, ''))
  await Promise.all(keys.map((key) => deleteR2KeyDirect(key)))
}
