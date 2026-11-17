import { createContext } from 'react'

/** Linear RGB. */
export type Rgb = [number, number, number]

const linear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export const luminanceOf = (rgb: Rgb): number => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

/**
 * AR-183 — an image's average color, linear RGB: the light a lightbox's film lets through, on
 * average (the wash on its wall takes its hue, the bake its brightness). Read from a 32 × 32 copy;
 * null when the image can't be read (not loaded, or a canvas it would taint).
 */
export const imageMeanColor = (image: unknown): Rgb | null => {
  if (!image || typeof document === 'undefined') return null
  try {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image as CanvasImageSource, 0, 0, size, size)
    const { data } = context.getImageData(0, 0, size, size)
    const sum: Rgb = [0, 0, 0]
    for (let i = 0; i < data.length; i += 4) {
      sum[0] += linear(data[i]!)
      sum[1] += linear(data[i + 1]!)
      sum[2] += linear(data[i + 2]!)
    }
    const n = size * size
    return [sum[0] / n, sum[1] / n, sum[2] / n]
  } catch {
    return null
  }
}

/**
 * The image's hue as a light's color: its average color at luminance 1, `share` of it (the rest
 * white). An unread image, or a black one, is white.
 */
export const meanHue = (mean: Rgb | null, share: number): Rgb => {
  const luminance = mean ? luminanceOf(mean) : 0
  if (!mean || luminance <= 1e-4) return [1, 1, 1]
  return mean.map((c) => 1 + (c / luminance - 1) * share) as Rgb
}

/**
 * Where a lightbox's front tells its display group what its image averages to (`Display` provides
 * it; the front's material reads its texture once loaded): the wash and the spill take its hue.
 */
export const LightboxImageMeanContext = createContext<(mean: Rgb | null) => void>(() => {})
