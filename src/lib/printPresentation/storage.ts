import { mkdir, readFile, rm, rmdir, stat, writeFile } from 'fs/promises'
import path from 'path'

import { bakeBackend } from '@/lib/bake/bakeStorage'
import { BAKE_CACHE_CONTROL } from '@/lib/bake/bakeUpload'
import {
  buildPresentationKey,
  deleteR2KeyDirect,
  getPresignedUploadUrl,
  getR2ObjectSize,
  publicUrlForKey,
} from '@/lib/r2'

import {
  PRESENTATION_WIDTH_PX,
  type PresentationSize,
  type PrintPresentationRecord,
} from './record'

/**
 * Where print presentations live — the same two backends as room bakes (`BAKE_STORAGE`):
 *
 * - `r2` (default): presigned PUTs straight to the bucket, served from its public URL, under
 *   `{env}/presentations/{artworkId}/{fingerprint}-{1800|900}.webp`. A new render has a new
 *   fingerprint, so a file is never overwritten — cached for a year, like bakes.
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
const FILE_PATTERN = /^([0-9a-f]{8})-(1800|900)\.webp$/

function assertSegments(artworkId: string, fingerprint: string) {
  if (!ARTWORK_SEGMENT.test(artworkId) || !PRESENTATION_FINGERPRINT.test(fingerprint)) {
    throw new Error('Invalid presentation path segment')
  }
}

function assertLocalAllowed() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    throw new Error('Local presentation storage is development-only')
  }
}

const fileName = (fingerprint: string, size: PresentationSize) =>
  `${fingerprint}-${PRESENTATION_WIDTH_PX[size]}.webp`

const localUrl = (artworkId: string, fingerprint: string, size: PresentationSize) =>
  `${LOCAL_URL_ROOT}/presentations/${artworkId}/${fileName(fingerprint, size)}`

/** The public URLs a render of `fingerprint` is stored at. */
export function presentationPublicUrls(
  artworkId: string,
  fingerprint: string,
): Record<PresentationSize, string> {
  assertSegments(artworkId, fingerprint)
  const url = (size: PresentationSize) =>
    bakeBackend() === 'local'
      ? localUrl(artworkId, fingerprint, size)
      : publicUrlForKey(buildPresentationKey(artworkId, fingerprint, PRESENTATION_WIDTH_PX[size]))
  return { large: url('large'), small: url('small') }
}

/** One upload URL per size (a presigned R2 PUT, or the local route), and where each is served. */
export async function createPresentationUploads(
  artworkId: string,
  fingerprint: string,
): Promise<Record<PresentationSize, { url: string; publicUrl: string }>> {
  const publicUrls = presentationPublicUrls(artworkId, fingerprint)
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    return {
      large: { url: publicUrls.large, publicUrl: publicUrls.large },
      small: { url: publicUrls.small, publicUrl: publicUrls.small },
    }
  }
  const [large, small] = await Promise.all(
    SIZES.map((size) =>
      getPresignedUploadUrl(
        buildPresentationKey(artworkId, fingerprint, PRESENTATION_WIDTH_PX[size]),
        'image/webp',
        3600,
        BAKE_CACHE_CONTROL,
      ),
    ),
  )
  return {
    large: { url: large, publicUrl: publicUrls.large },
    small: { url: small, publicUrl: publicUrls.small },
  }
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
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, bytes)
}

export async function readLocalPresentationFile(filePath: string): Promise<Buffer | null> {
  assertLocalAllowed()
  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}

/** Byte size of a stored render, or null when it isn't there. */
export async function presentationObjectSize(
  artworkId: string,
  fingerprint: string,
  size: PresentationSize,
): Promise<number | null> {
  assertSegments(artworkId, fingerprint)
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    try {
      return (await stat(path.join(LOCAL_ROOT, artworkId, fileName(fingerprint, size)))).size
    } catch {
      return null
    }
  }
  return getR2ObjectSize(buildPresentationKey(artworkId, fingerprint, PRESENTATION_WIDTH_PX[size]))
}

/** Removes both files of a stored render. Missing files are fine. */
export async function deletePresentationFiles(
  record: PrintPresentationRecord,
  artworkId: string,
): Promise<void> {
  if (!PRESENTATION_FINGERPRINT.test(record.fingerprint)) return
  assertSegments(artworkId, record.fingerprint)
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    await Promise.all(
      SIZES.map((size) =>
        rm(path.join(LOCAL_ROOT, artworkId, fileName(record.fingerprint, size)), { force: true }),
      ),
    )
    // Drop the artwork's folder once its last render is gone (fails harmlessly if not empty).
    await rmdir(path.join(LOCAL_ROOT, artworkId)).catch(() => {})
    return
  }
  await Promise.all(
    SIZES.map((size) =>
      deleteR2KeyDirect(
        buildPresentationKey(artworkId, record.fingerprint, PRESENTATION_WIDTH_PX[size]),
      ),
    ),
  )
}
