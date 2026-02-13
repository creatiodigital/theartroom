import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'

import prisma from '@/lib/prisma'

const getCachedArtist = (slug: string) =>
  unstable_cache(
    async () => {
      return prisma.user.findUnique({
        where: { handler: slug },
        select: {
          id: true,
          name: true,
          lastName: true,
          handler: true,
          biography: true,
          profileImageUrl: true,
          published: true,
        },
      })
    },
    [`artist-${slug}`],
    { tags: [`artist-${slug}`, 'artists'], revalidate: 3600 },
  )()

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params

    const artist = await getCachedArtist(slug)

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    // Hide unpublished artists from public
    if (!artist.published) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    return NextResponse.json(artist)
  } catch (error) {
    console.error('[GET /api/artists/[slug]] error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
