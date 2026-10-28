import { BAKE_CACHE_CONTROL } from '@/lib/bake/bakeUpload'
import type { PresentationWindow } from '@/lib/printPresentation/geometry'
import { PRESENTATION_WIDTH_PX, type PresentationSize } from '@/lib/printPresentation/record'
import { checkShot } from '@/lib/printPresentation/shotCheck'

/**
 * Turning a finished studio shot into the two stored files, and storing them. Runs in the admin's
 * browser. WebP keeps the shot's transparency (the artwork's window); Chrome encodes it, Safari
 * silently hands back PNG — hence `supportsWebpAlpha`.
 */

const QUALITY = 0.92

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode the shot'))),
      'image/webp',
      QUALITY,
    ),
  )

/** Whether this browser really encodes WebP (with transparency) from a canvas. */
export async function supportsWebpAlpha(): Promise<boolean> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 2
  try {
    return (await toBlob(canvas)).type === 'image/webp'
  } catch {
    return false
  }
}

/**
 * Both stored sizes from one shot: the large one is the shot itself, the small one drawn down.
 * Refuses a shot that isn't a wall around a transparent window (`checkShot`) — a blank or
 * broken capture is reported and the work stays as it was.
 */
export async function encodeShot(
  canvas: HTMLCanvasElement,
  window: PresentationWindow,
): Promise<Record<PresentationSize, Blob>> {
  const small = document.createElement('canvas')
  small.width = PRESENTATION_WIDTH_PX.small
  small.height = Math.round((canvas.height * PRESENTATION_WIDTH_PX.small) / canvas.width)
  const ctx = small.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, small.width, small.height)
  const pixel = (x: number, y: number) => {
    const [r, g, b, a] = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data
    return [r, g, b, a] as const
  }
  // The darkest channel along the four outer edges: a shadow cut by the crop shows there.
  const edges = [
    ctx.getImageData(0, 0, small.width, 1),
    ctx.getImageData(0, small.height - 1, small.width, 1),
    ctx.getImageData(0, 0, 1, small.height),
    ctx.getImageData(small.width - 1, 0, 1, small.height),
  ]
  let edgeMin = 255
  for (const { data } of edges) {
    for (let i = 0; i < data.length; i += 4) {
      edgeMin = Math.min(edgeMin, data[i], data[i + 1], data[i + 2])
    }
  }
  const problem = checkShot({
    edgeMin,
    corner: pixel(1, 1),
    windowCenter: pixel(
      (window.x + window.w / 2) * small.width,
      (window.y + window.h / 2) * small.height,
    ),
  })
  if (problem) throw new Error(problem)
  const [large, smallBlob] = await Promise.all([toBlob(canvas), toBlob(small)])
  return { large, small: smallBlob }
}

/**
 * The headers a file's PUT sends to `url`: always its type. An upload URL on another origin is an
 * R2 presigned PUT, which signs the cache header too — it must be sent, exactly. The local backend
 * (development) is on this origin and sets its own.
 */
export const presentationUploadHeaders = (url: string, origin: string): Record<string, string> =>
  new URL(url, origin).origin === new URL(origin).origin
    ? { 'Content-Type': 'image/webp' }
    : { 'Content-Type': 'image/webp', 'Cache-Control': BAKE_CACHE_CONTROL }

const refused = async (response: Response, what: string) => {
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null
  const reason = typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`
  return new Error(`${what}: ${reason}`)
}

/**
 * Stores one render: upload URLs for both sizes, both files, then the record — in that order, so
 * nothing is saved unless every file is stored (the server checks too).
 */
export async function storeShot(
  artworkId: string,
  fingerprint: string,
  window: PresentationWindow,
  files: Record<PresentationSize, Blob>,
  origin: string,
): Promise<void> {
  const base = `/api/admin/print-presentations/${artworkId}`
  const started = await fetch(`${base}/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint }),
  })
  if (!started.ok) throw await refused(started, 'Upload refused')
  const uploads = (await started.json()) as Record<PresentationSize, { url: string }>

  for (const size of ['large', 'small'] as const) {
    const put = await fetch(uploads[size].url, {
      method: 'PUT',
      headers: presentationUploadHeaders(uploads[size].url, origin),
      body: files[size],
    })
    if (!put.ok) throw new Error(`Storing the ${size} file failed: HTTP ${put.status}`)
  }

  const saved = await fetch(base, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint, window }),
  })
  if (!saved.ok) throw await refused(saved, 'Saving refused')
}
