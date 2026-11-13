import { RichText } from '@/components/ui/RichText'
import { TextSection } from '@/components/ui/TextSection'
import { isRichTextEmpty } from '@/lib/textUtils'

import styles from './ArtworkStorySection.module.scss'

/**
 * "About the work" (docs/public-redesign/artwork.md "Below the work"): the artwork's own story, as a
 * TextSection after the two columns: the small grey caps label on the left, the text on the right.
 * Absent entirely when the artwork has no description, which is most of them and is not a degraded
 * state. Today's story text, unchanged.
 */
export const ArtworkStorySection = ({ description }: { description?: string | null }) => {
  // `isRichTextEmpty` covers null, undefined, whitespace and tag-only HTML — an
  // empty TipTap document is "<p></p>", not "". Without that last case the
  // section would render a label over a blank space on most artworks.
  if (isRichTextEmpty(description)) return null

  return (
    <TextSection label="About the work" className={styles.story}>
      <RichText content={description!} variant="page" className={styles.body} />
    </TextSection>
  )
}
