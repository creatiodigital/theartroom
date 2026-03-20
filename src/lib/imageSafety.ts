/**
 * Allowed image hostnames for next/image.
 * Must match the `remotePatterns` in next.config.mjs.
 */
const ALLOWED_HOSTS = new Set(['assets.theartroom.gallery'])

/**
 * Check whether a URL is safe to pass to next/image.
 * Returns true for relative paths, blob: URLs, data: URLs,
 * and URLs whose hostname is in the allowed list.
 */
export function isSafeImageSrc(src: string | undefined | null): boolean {
  if (!src) return false

  // Relative paths, blob URLs, and data URLs are always safe
  if (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('data:')) return true

  try {
    const { hostname } = new URL(src)
    return ALLOWED_HOSTS.has(hostname)
  } catch {
    return false
  }
}
