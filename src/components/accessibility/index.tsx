'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

export const AccessibilityPage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Accessibility Policy"
        pageSubtitle="Our commitment to making The Art Room accessible to everyone"
      />
      <StaticPageContent slug="accessibility" />
    </PageLayout>
  )
}
