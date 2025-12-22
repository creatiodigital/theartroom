import sharp from 'sharp'

import { STORED_IMAGE } from './imageConfig'

const MAX_DIMENSION = STORED_IMAGE.MAX_DIMENSION
const WEBP_QUALITY_INITIAL = STORED_IMAGE.WEBP_QUALITY
const MAX_FILE_SIZE = STORED_IMAGE.MAX_FILE_SIZE
const MIN_QUALITY = STORED_IMAGE.MIN_QUALITY

/**
 * Process an image buffer:
 * - Resize to max 4096px (longest side) for high-quality source
 * - Convert to WebP with adaptive quality to stay under 2MB
 * - Returns processed buffer suitable for Vercel Image Optimization
 */
export async function processImage(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  let resized = image

  // Resize if larger than max dimension
  if (metadata.width && metadata.height) {
    const longestSide = Math.max(metadata.width, metadata.height)

    if (longestSide > MAX_DIMENSION) {
      if (metadata.width > metadata.height) {
        resized = image.resize({ width: MAX_DIMENSION })
      } else {
        resized = image.resize({ height: MAX_DIMENSION })
      }
    }
  }

  // Start with initial quality and reduce if file too large
  let quality = WEBP_QUALITY_INITIAL
  let processed = await resized.webp({ quality }).toBuffer()

  // Iteratively reduce quality if file is too large
  while (processed.length > MAX_FILE_SIZE && quality > MIN_QUALITY) {
    quality -= 5
    processed = await resized.webp({ quality }).toBuffer()
  }

  return processed
}

/**
 * Get image metadata
 */
export async function getImageMetadata(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
  }
}

/**
 * Validate image file type by checking magic bytes
 */
export function isValidImageType(buffer: Buffer): boolean {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return true
    }
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true
  }

  return false
}
