import type { Metadata } from 'next'

import { AccessibilityPage } from '@/components/accessibility'

export const metadata: Metadata = {
  title: { absolute: 'The Art Room Accessibility Policy' },
  description: 'Accessibility commitment and policies for The Art Room platform.',
}

export default function Page() {
  return <AccessibilityPage />
}
