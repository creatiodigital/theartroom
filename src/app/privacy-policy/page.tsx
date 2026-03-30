import type { Metadata } from 'next'

import { PrivacyPage } from '@/components/privacy'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Privacy Policy' },
  description: 'Privacy policy for The Art Room platform.',
}

export default function Page() {
  return <PrivacyPage />
}
