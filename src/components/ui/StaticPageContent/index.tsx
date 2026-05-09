import { Text } from '@/components/ui/Typography'
import { RichText } from '@/components/ui/RichText'

interface StaticPageContentProps {
  content: string | null
}

export const StaticPageContent = ({ content }: StaticPageContentProps) => {
  if (!content) {
    return (
      <div>
        <Text as="p">Content not found.</Text>
      </div>
    )
  }

  return (
    <div>
      <RichText content={content} />
    </div>
  )
}
