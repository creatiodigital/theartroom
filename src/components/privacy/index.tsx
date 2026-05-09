import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

interface PrivacyPageProps {
  content: string | null
}

export const PrivacyPage = ({ content }: PrivacyPageProps) => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Privacy Policy"
        pageSubtitle="How we collect, use, and protect your personal information"
      />
      <StaticPageContent content={content} />
    </PageLayout>
  )
}
