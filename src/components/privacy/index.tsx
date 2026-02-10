'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

export const PrivacyPage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Privacy Policy"
        pageSubtitle="How we collect, use, and protect your personal information"
      />
      <StaticPageContent slug="privacy" />
    </PageLayout>
  )
}
