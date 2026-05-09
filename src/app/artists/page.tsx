import { unstable_cache } from 'next/cache'
import type { Metadata } from 'next'

import { ArtistsPage } from '@/components/artists'
import prisma from '@/lib/prisma'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Artists' },
  description:
    'Discover the artists exhibiting at The Art Room. Explore their profiles, biographies, and virtual exhibitions.',
}

// Tag matches the 'artists' invalidation already used in the write paths.
const getCachedArtistsList = unstable_cache(
  () =>
    prisma.user.findMany({
      where: { userType: 'artist', published: true },
      select: {
        id: true,
        name: true,
        lastName: true,
        handler: true,
        biography: true,
        profileImageUrl: true,
      },
      orderBy: { name: 'asc' },
    }),
  ['artists-public-list'],
  { tags: ['artists'], revalidate: 3600 },
)

const Artists = async () => {
  const artists = await getCachedArtistsList()
  return <ArtistsPage artists={artists} />
}

export default Artists
