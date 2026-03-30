import type { Metadata } from 'next'

import { TermsPage } from '@/components/terms'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Terms and Conditions' },
  description: 'Terms and conditions for using The Art Room platform.',
}

export default function Page() {
  return <TermsPage />
}
