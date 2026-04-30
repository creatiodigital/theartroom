/**
 * Provider-agnostic formatters used across the wizard, summary, and any
 * downstream surface that displays prices or sizes. Live in the
 * print-providers root so callers don't have to know which adapter
 * handled their order.
 */
import type { SizeOption } from './types'

export function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

// Output follows art-gallery convention: height × width.
// Args still take (wCm, hCm) so callers don't have to swap; the
// function reorders internally for display.
export function formatDualDimensions(wCm: number, hCm: number): string {
  return `${hCm} × ${wCm} cm`
}

/**
 * Sizes are typically declared portrait (height ≥ width). Landscape
 * orientation swaps the two so the label matches how the print will
 * actually hang. Display order is height × width (gallery convention).
 */
export function formatSizeForOrientation(
  size: { widthCm: number; heightCm: number },
  orientation: 'portrait' | 'landscape',
): string {
  const isLandscape = orientation === 'landscape'
  const wCm = isLandscape ? size.heightCm : size.widthCm
  const hCm = isLandscape ? size.widthCm : size.heightCm
  return formatDualDimensions(wCm, hCm)
}

export function sizeOptionLabel(size: SizeOption, orientation: 'portrait' | 'landscape'): string {
  return formatSizeForOrientation(size, orientation)
}
