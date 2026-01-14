// Upload limits
export const MAX_UPLOAD_SIZE = 1 * 1024 * 1024 // 1MB

// Processing settings for stored image (high-quality source for Vercel optimization)
export const STORED_IMAGE = {
  MAX_DIMENSION: 4096,
  WEBP_QUALITY: 90,
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB target
  MIN_QUALITY: 70,
}

// Vercel Image Optimization presets
export const IMAGE_PRESETS = {
  gallery3D: { width: 1536, quality: 80 },
  isolated: { width: 2048, quality: 100 },
  thumbnail: { width: 400, quality: 70 },
} as const
