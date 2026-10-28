import sharp from 'sharp'

import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { publicUrlForKey } from '@/lib/r2'

import { shapeOf } from './inputs'
import type { SourceRow } from './loadSources'

/** Web images fetched at once. */
const AT_ONCE = 4
const TIMEOUT_MS = 15_000

/**
 * Gives a shape to the image works that have none. A work with no original file (older works, and
 * images added in the exhibition editor) has no original size; its web image has the same shape,
 * so it's measured once and stored (`Artwork.presentationRatio`). Only images on our own asset
 * host are fetched. One that fails stays "Not eligible" and is tried again on the next load.
 */
export async function measureMissingRatios(sources: SourceRow[]): Promise<SourceRow[]> {
  const ours = publicUrlForKey('')
  const todo = sources.filter(
    (s) => s.artworkType === 'image' && shapeOf(s) === null && s.imageUrl?.startsWith(ours),
  )
  if (!todo.length) return sources

  const measured = new Map<string, number>()
  for (let i = 0; i < todo.length; i += AT_ONCE) {
    await Promise.all(
      todo.slice(i, i + AT_ONCE).map(async (source) => {
        try {
          const ratio = await webImageRatio(source.imageUrl as string)
          await prisma.artwork.update({
            where: { id: source.id },
            data: { presentationRatio: ratio },
          })
          measured.set(source.id, ratio)
        } catch (err) {
          captureError(err, {
            flow: 'admin',
            stage: 'measure-presentation-ratio',
            level: 'warning',
            extra: { artworkId: source.id },
          })
        }
      }),
    )
  }
  return sources.map((s) =>
    measured.has(s.id) ? { ...s, presentationRatio: measured.get(s.id) as number } : s,
  )
}

async function webImageRatio(url: string): Promise<number> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Web image ${res.status}: ${url}`)
  const { width, height } = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
  if (!width || !height) throw new Error(`Web image has no size: ${url}`)
  return width / height
}
