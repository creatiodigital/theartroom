import { ContentPage } from '@/components/ui/ContentPage'

interface TermsPageProps {
  content: string | null
}

// The content-page template (docs/public-redesign/legal.md); title in sentence case.
export const TermsPage = ({ content }: TermsPageProps) => (
  <ContentPage
    title="Terms and conditions"
    subtitle="Please review our terms of use before using this website."
    content={content}
  />
)
