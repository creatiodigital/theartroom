import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getArtworkMedia } from '@/lib/artwork/artworkMedia'
import { getMoreByArtist } from '@/lib/queries/getMoreByArtist'
import prisma from '@/lib/prisma'

/**
 * An Object's page as data (docs/objects O6): what the 3D room's window shows when a visitor
 * clicks an Object on the floor, the same content as /artworks/[slug]. Public, like the page:
 * published artists only, Objects only, no print internals (Objects are not prints).
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const row = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      title: true,
      author: true,
      year: true,
      technique: true,
      description: true,
      imageUrl: true,
      originalWidth: true,
      originalHeight: true,
      artworkType: true,
      heightCm: true,
      widthCm: true,
      depthCm: true,
      weightKg: true,
      sizeIncludesBase: true,
      placement: true,
      displayMode: true,
      signedNote: true,
      certificateNote: true,
      careNote: true,
      modelStatus: true,
      modelUrl: true,
      modelBoundsCm: true,
      user: { select: { name: true, lastName: true, handler: true, published: true } },
    },
  })
  if (!row || row.artworkType !== 'object' || !row.user.published) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { user, modelStatus, modelUrl, modelBoundsCm, ...artwork } = row
  const [media, more] = await Promise.all([
    getArtworkMedia(row.id),
    getMoreByArtist(user.handler, slug),
  ])
  return NextResponse.json({
    artwork: {
      ...artwork,
      model:
        modelStatus === 'ready' && modelUrl
          ? { url: modelUrl, boundsCm: modelBoundsCm as { h: number; w: number; d: number } | null }
          : null,
    },
    artist: { name: user.name, lastName: user.lastName, handler: user.handler },
    media,
    more,
  })
}
