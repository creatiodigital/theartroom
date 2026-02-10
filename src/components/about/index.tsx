'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

export const AboutPage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="About"
        pageSubtitle="A Space for Art, Dialogue, and Experimentation."
      />
      <StaticPageContent slug="about" />
    </PageLayout>
  )
}
