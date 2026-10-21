import { mkdir, readFile, rm, rmdir, stat, writeFile } from 'fs/promises'
import path from 'path'

import {
  buildExhibitionBakeKey,
  deleteR2KeyDirect,
  getPresignedUploadUrl,
  getR2ObjectSize,
  listAllR2Keys,
  publicUrlForKey,
} from '@/lib/r2'

import { BAKE_CACHE_CONTROL } from './bakeUpload'

/**
 * One seam for where a stored bake's PNG maps live (AR-161).
 *
 * - `r2` (default): presigned PUTs straight to the bucket, served from its public URL.
 * - `local`: development only. Files sit under `.bake-files/` at the repo root and are
 *   served by `/api/bake-files/[...key]`.
 *
 * Both lay a bake out the same way: `exhibitions/{exhibitionId}/bakes/{bakeId}/{file}`.
 */

export interface BakeUpload {
  file: string
  url: string
  method: 'PUT'
  publicUrl: string
}

// One value for the presigned PUT (signed) and the browser that sends it (`bakeUpload`).
export { BAKE_CACHE_CONTROL }
export const BAKE_FILE_PATTERN = /^[a-z-]+\.png$/
/** An exhibition or bake id as a single path segment: no dots, slashes or backslashes. */
export const BAKE_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/

const LOCAL_URL_ROOT = '/api/bake-files'
const LOCAL_ROOT = path.join(process.cwd(), '.bake-files')

export function bakeBackend(): 'local' | 'r2' {
  return process.env.BAKE_STORAGE === 'local' ? 'local' : 'r2'
}

function assertSegments(...segments: string[]) {
  for (const segment of segments) {
    if (!BAKE_SEGMENT_PATTERN.test(segment)) throw new Error('Invalid bake path segment')
  }
}

function assertLocalAllowed() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') {
    throw new Error('Local bake storage is development-only')
  }
}

/** The r2 key (without the env prefix) shape, shared by both backends. */
function relativeKey(exhibitionId: string, bakeId: string, file: string): string {
  return `exhibitions/${exhibitionId}/bakes/${bakeId}/${file}`
}

/** URL prefix every map of this exhibition's bake `bakeId` must live under. */
export function bakeUrlPrefix(exhibitionId: string, bakeId: string): string {
  assertSegments(exhibitionId, bakeId)
  if (bakeBackend() === 'local') {
    return `${LOCAL_URL_ROOT}/${relativeKey(exhibitionId, bakeId, '')}`
  }
  return publicUrlForKey(buildExhibitionBakeKey(exhibitionId, bakeId, ''))
}

/**
 * The file name of `publicUrl` when it is exactly `{bakeUrlPrefix}{file}.png` and
 * nothing else (no query, fragment, subfolder or foreign host); otherwise null.
 */
export function bakeFileOfUrl(
  exhibitionId: string,
  bakeId: string,
  publicUrl: string,
): string | null {
  const prefix = bakeUrlPrefix(exhibitionId, bakeId)
  if (!publicUrl.startsWith(prefix)) return null
  const file = publicUrl.slice(prefix.length)
  return BAKE_FILE_PATTERN.test(file) ? file : null
}

/** Resolves an already-validated local key to a path inside `.bake-files/`, or null. */
export function localBakePath(key: string[]): string | null {
  if (key.length !== 5) return null
  const [exhibitions, exhibitionId, bakes, bakeId, file] = key
  if (exhibitions !== 'exhibitions' || bakes !== 'bakes') return null
  if (!BAKE_SEGMENT_PATTERN.test(exhibitionId) || !BAKE_SEGMENT_PATTERN.test(bakeId)) return null
  if (!BAKE_FILE_PATTERN.test(file)) return null
  const resolved = path.resolve(LOCAL_ROOT, exhibitionId, bakeId, file)
  return resolved.startsWith(LOCAL_ROOT + path.sep) ? resolved : null
}

export async function writeLocalBakeFile(filePath: string, bytes: Buffer): Promise<void> {
  assertLocalAllowed()
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, bytes)
}

export async function readLocalBakeFile(filePath: string): Promise<Buffer | null> {
  assertLocalAllowed()
  try {
    return await readFile(filePath)
  } catch {
    return null
  }
}

export async function createBakeUploads(
  exhibitionId: string,
  bakeId: string,
  files: string[],
): Promise<BakeUpload[]> {
  assertSegments(exhibitionId, bakeId)
  for (const file of files) {
    if (!BAKE_FILE_PATTERN.test(file)) throw new Error('Invalid bake file name')
  }

  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    return files.map((file) => {
      const url = `${LOCAL_URL_ROOT}/${relativeKey(exhibitionId, bakeId, file)}`
      return { file, url, method: 'PUT' as const, publicUrl: url }
    })
  }

  return Promise.all(
    files.map(async (file) => {
      const key = buildExhibitionBakeKey(exhibitionId, bakeId, file)
      const url = await getPresignedUploadUrl(key, 'image/png', 3600, BAKE_CACHE_CONTROL)
      return { file, url, method: 'PUT' as const, publicUrl: publicUrlForKey(key) }
    }),
  )
}

/** Byte size of a stored map, or null when it does not exist / cannot be read. */
export async function bakeObjectSize(publicUrl: string): Promise<number | null> {
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    if (!publicUrl.startsWith(`${LOCAL_URL_ROOT}/`)) return null
    const filePath = localBakePath(publicUrl.slice(LOCAL_URL_ROOT.length + 1).split('/'))
    if (!filePath) return null
    try {
      return (await stat(filePath)).size
    } catch {
      return null
    }
  }
  const base = publicUrlForKey('')
  if (!publicUrl.startsWith(base)) return null
  return getR2ObjectSize(publicUrl.slice(base.length))
}

export async function deleteBakeObjects(exhibitionId: string, bakeId: string): Promise<void> {
  assertSegments(exhibitionId, bakeId)
  if (bakeBackend() === 'local') {
    assertLocalAllowed()
    await rm(path.join(LOCAL_ROOT, exhibitionId, bakeId), { recursive: true, force: true })
    // Drop the exhibition folder once its last bake is gone (fails harmlessly if not empty).
    await rmdir(path.join(LOCAL_ROOT, exhibitionId)).catch(() => {})
    return
  }
  const keys = await listAllR2Keys(buildExhibitionBakeKey(exhibitionId, bakeId, ''))
  await Promise.all(keys.map((key) => deleteR2KeyDirect(key)))
}
