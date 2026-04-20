import type { Metadata } from 'next'

import { PrintsPage } from '@/components/prints'

export const metadata: Metadata = {
  title: { absolute: 'Prints · The Art Room' },
  description:
    'Order fine-art prints of selected works from The Art Room artists, produced on museum-grade paper.',
}

const Prints = () => {
  return <PrintsPage />
}

export default Prints
