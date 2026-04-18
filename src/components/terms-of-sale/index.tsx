'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

export const TermsOfSalePage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Online Terms of Sale"
        pageSubtitle="The terms that apply when you buy a printed artwork from us."
      />
      <StaticPageContent slug="sale-terms" />
    </PageLayout>
  )
}
