import { photoProblem } from '@/lib/printPresentation/shotCheck'
import { PHOTO_WIDTH_PX, type PresentationSize } from '@/lib/printPresentation/record'

/**
 * Turning a rendered photo view into its two stored files. Runs in the admin's browser (Chrome:
 * the render page checks WebP really encodes).
 */
const QUALITY = 0.9

const toWebp = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode the photo'))),
      'image/webp',
      QUALITY,
    ),
  )

const drawnDown = (canvas: HTMLCanvasElement, width: number) => {
  const out = document.createElement('canvas')
  out.width = width
  out.height = Math.round((canvas.height * width) / canvas.width)
  const ctx = out.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No 2D canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, out.width, out.height)
  return { out, ctx }
}

/** Why a rendered photo is wrong (black, flat), or null: measured on it drawn down to 120 px. */
export function checkPhoto(canvas: HTMLCanvasElement): string | null {
  const { out, ctx } = drawnDown(canvas, 120)
  const { data } = ctx.getImageData(0, 0, out.width, out.height)
  let sum = 0
  let sq = 0
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    sum += y
    sq += y * y
  }
  const mean = sum / n
  return photoProblem({ mean, sd: Math.sqrt(Math.max(0, sq / n - mean * mean)) })
}

/** Both stored sizes of a photo: the render itself (2400) and the tile (600), WebP. */
export async function encodePhoto(
  canvas: HTMLCanvasElement,
): Promise<Record<PresentationSize, Blob>> {
  const problem = checkPhoto(canvas)
  if (problem) throw new Error(problem)
  const { out } = drawnDown(canvas, PHOTO_WIDTH_PX.small)
  const [large, small] = await Promise.all([toWebp(canvas), toWebp(out)])
  return { large, small }
}
