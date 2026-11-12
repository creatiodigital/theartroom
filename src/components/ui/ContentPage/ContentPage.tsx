import c from 'classnames'

import { PageLayout } from '@/components/ui/PageLayout'
import { RichText, sanitizeRichText } from '@/components/ui/RichText'
import { withHeadingAnchors } from '@/lib/richText/headingAnchors'

import { OnThisPage } from './OnThisPage'
import styles from './ContentPage.module.scss'

/** Below this many H2s a page has no "On this page" and its text starts at the left. */
const MIN_HEADINGS_FOR_LIST = 3

type ContentPageProps = {
  /** Sentence case. */
  title: string
  subtitle?: string
  /** The page editor's HTML (Admin › Content), as today. */
  content: string | null
}

/**
 * One template for every rich-text page (docs/public-redesign/legal.md, designs/legal-*.dc.html):
 * the title and its line under the header, a hairline, then "On this page" (the text's H2s,
 * built here) beside the text. Only layout and hierarchy; the content is the editor's.
 */
export const ContentPage = ({ title, subtitle, content }: ContentPageProps) => {
  const headings = content ? withHeadingAnchors(sanitizeRichText(content)).headings : []
  const withList = headings.length >= MIN_HEADINGS_FOR_LIST

  return (
    <PageLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </header>
        <div className={c(styles.body, withList && styles.withList)}>
          {withList && <OnThisPage headings={headings} />}
          <div className={styles.text}>
            {content ? (
              <RichText content={content} variant="page" anchorHeadings />
            ) : (
              <p className={styles.missing}>Content not found.</p>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
