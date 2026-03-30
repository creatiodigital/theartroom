import type { Metadata } from 'next'

import { ArtistsPage } from '@/components/artists'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Artists' },
  description:
    'Discover the artists exhibiting at The Art Room. Explore their profiles, biographies, and virtual exhibitions.',
}

const Artists = () => {
  return <ArtistsPage />
}

export default Artists
