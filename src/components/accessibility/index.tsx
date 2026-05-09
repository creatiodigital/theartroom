import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

interface AccessibilityPageProps {
  content: string | null
}

export const AccessibilityPage = ({ content }: AccessibilityPageProps) => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Accessibility Policy"
        pageSubtitle="Our commitment to making The Art Room accessible to everyone"
      />
      <StaticPageContent content={content} />
    </PageLayout>
  )
}
