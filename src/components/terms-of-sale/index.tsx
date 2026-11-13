import { ContentPage } from '@/components/ui/ContentPage'

interface TermsOfSalePageProps {
  content: string | null
}

// The content-page template (docs/public-redesign/legal.md); title in sentence case.
export const TermsOfSalePage = ({ content }: TermsOfSalePageProps) => (
  <ContentPage
    title="Online terms of sale"
    subtitle="The terms that apply when you buy a printed artwork from us."
    content={content}
  />
)
