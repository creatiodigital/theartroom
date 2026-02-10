'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

export const TermsPage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Terms and Conditions"
        pageSubtitle="Please review our terms of use before using this website"
      />
      <StaticPageContent slug="terms" />
    </PageLayout>
  )
}
