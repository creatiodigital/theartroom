import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { StaticPageContent } from '@/components/ui/StaticPageContent'

interface AboutPageProps {
  content: string | null
}

export const AboutPage = ({ content }: AboutPageProps) => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="About"
        pageSubtitle="A Space for Art, Dialogue, and Experimentation."
      />
      <StaticPageContent content={content} />
    </PageLayout>
  )
}
