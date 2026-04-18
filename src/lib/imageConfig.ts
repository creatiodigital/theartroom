// Upload limits
export const MAX_UPLOAD_SIZE = 1 * 1024 * 1024 // 1MB (default for profile, exhibition, carousel)
export const MAX_ARTWORK_UPLOAD_SIZE = 200 * 1024 * 1024 // 200MB (artwork images for print)

// Minimum resolution for uploaded images
export const MIN_IMAGE_WIDTH = 0 // No minimum by default
export const MIN_IMAGE_HEIGHT = 0

// Minimum resolution for artwork images
export const MIN_ARTWORK_IMAGE_WIDTH = 1200
export const MIN_ARTWORK_IMAGE_HEIGHT = 1200

// Minimum resolution for print eligibility (smallest Prodigi SKU: 20×25 cm @ 300 DPI)
export const MIN_PRINT_WIDTH = 2400
export const MIN_PRINT_HEIGHT = 2400

// Processing settings for stored image (high-quality source for Vercel optimization)
export const STORED_IMAGE = {
  MAX_DIMENSION: 2048, // Covers magnifier (2048px) and 3D scene (1536px)
  WEBP_QUALITY: 85,
  MAX_FILE_SIZE: 1 * 1024 * 1024, // 1MB target for stored WebP
  MIN_QUALITY: 70,
}

// Vercel Image Optimization presets
export const IMAGE_PRESETS = {
  gallery3D: { width: 1536, quality: 80 },
  isolated: { width: 2048, quality: 100 },
  thumbnail: { width: 400, quality: 70 },
} as const
