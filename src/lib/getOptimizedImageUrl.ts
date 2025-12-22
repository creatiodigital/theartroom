import { IMAGE_PRESETS } from './imageConfig'

type Preset = keyof typeof IMAGE_PRESETS

/**
 * Generate a Vercel-optimized image URL for different viewing contexts.
 * Uses Vercel's Image Optimization API for on-demand transformations.
 *
 * @param originalUrl - The original blob URL
 * @param preset - 'gallery3D' (small/fast), 'isolated' (high quality), or 'thumbnail'
 * @returns Optimized URL via /_next/image endpoint
 */
export function getOptimizedImageUrl(originalUrl: string, preset: Preset): string {
  // Skip optimization for local blob URLs (development preview)
  if (originalUrl.startsWith('blob:')) {
    return originalUrl
  }

  const { width, quality } = IMAGE_PRESETS[preset]
  return `/_next/image?url=${encodeURIComponent(originalUrl)}&w=${width}&q=${quality}`
}
