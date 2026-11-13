import { ContentPage } from '@/components/ui/ContentPage'

interface PrivacyPageProps {
  content: string | null
}

// The content-page template (docs/public-redesign/legal.md); title in sentence case.
export const PrivacyPage = ({ content }: PrivacyPageProps) => (
  <ContentPage
    title="Privacy policy"
    subtitle="How we collect, use, and protect your personal information."
    content={content}
  />
)
