import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

interface TermsPageProps {
  content: string | null
}

export const TermsPage = ({ content }: TermsPageProps) => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Terms and Conditions"
        pageSubtitle="Please review our terms of use before using this website"
      />
      <StaticPageContent content={content} />
    </PageLayout>
  )
}
