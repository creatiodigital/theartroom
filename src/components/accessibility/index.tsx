import { ContentPage } from '@/components/ui/ContentPage'

interface AccessibilityPageProps {
  content: string | null
}

// The content-page template (docs/public-redesign/legal.md); title in sentence case.
export const AccessibilityPage = ({ content }: AccessibilityPageProps) => (
  <ContentPage
    title="Accessibility policy"
    subtitle="Our commitment to making The Art Room accessible to everyone."
    content={content}
  />
)
