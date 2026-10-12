import sharp from 'sharp'

import { monogramCard } from '@/lib/og/monogramCard'

export const SHARE_PREVIEW_SIZE = { width: 1200, height: 630 }

// Room around the work, as on a gallery wall.
const MARGIN = 40
const FETCH_TIMEOUT_MS = 8000

const CACHE_HEADERS = {
  'Content-Type': 'image/jpeg',
  // Platforms fetch a preview once per share; a day at the CDN keeps that
  // from re-rendering, and a stale copy is fine while a new one renders.
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
}

/**
 * The share preview for a page with its own main image (an exhibition's
 * cover, an artwork, an artist's photo): that image whole and uncropped,
 * centered on a white 1200 × 630 canvas, as a light JPEG.
 *
 * Why not link the stored image directly: those are WebPs of ~800 KB at their
 * own proportions, and WhatsApp shows no picture at all for images that heavy.
 * `imageUrl` must be the web-size copy the page already displays, never the
 * print master. With no image, or one that can't be fetched or decoded, the
 * monogram card stands in, so a shared link never loses its picture.
 */
export async function renderSharePreview(imageUrl: string | null | undefined) {
  if (imageUrl) {
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (res.ok) {
        const work = await sharp(Buffer.from(await res.arrayBuffer()))
          .rotate()
          .resize(SHARE_PREVIEW_SIZE.width - MARGIN * 2, SHARE_PREVIEW_SIZE.height - MARGIN * 2, {
            fit: 'inside',
          })
          .flatten({ background: '#ffffff' })
          .toBuffer()
        const jpeg = await sharp({
          create: { ...SHARE_PREVIEW_SIZE, channels: 3, background: '#ffffff' },
        })
          .composite([{ input: work, gravity: 'center' }])
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer()
        return new Response(new Uint8Array(jpeg), { headers: CACHE_HEADERS })
      }
    } catch (error) {
      console.error('[share-preview] falling back to the monogram card:', imageUrl, error)
    }
  }

  // Same JPEG type as the success path, so the route's declared contentType
  // holds either way.
  const card = await monogramCard(SHARE_PREVIEW_SIZE).arrayBuffer()
  const jpeg = await sharp(Buffer.from(card)).jpeg({ quality: 90 }).toBuffer()
  return new Response(new Uint8Array(jpeg), { headers: CACHE_HEADERS })
}
