import type { Metadata } from 'next'

import { ExhibitionsPage } from '@/components/exhibitions'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Exhibitions' },
  description:
    'Browse current and past virtual exhibitions at The Art Room. Experience contemporary art in immersive 3D gallery spaces.',
}

const Exhibitions = () => {
  return <ExhibitionsPage />
}

export default Exhibitions
