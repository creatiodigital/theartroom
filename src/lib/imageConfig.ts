// Upload limits
export const MAX_UPLOAD_SIZE = 1 * 1024 * 1024 // 1MB

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
