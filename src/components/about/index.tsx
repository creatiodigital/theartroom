import { ArrowLink, ArrowLinkDivider, ArrowLinkRow } from '@/components/ui/ArrowLink'
import { Band } from '@/components/ui/Band'
import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'
import { RichText } from '@/components/ui/RichText'
import { TextSection } from '@/components/ui/TextSection'
import { splitAtH2 } from '@/lib/richText/headingAnchors'

import styles from './About.module.scss'

const FIRST_SECTION_LABEL = 'The gallery'

interface AboutPageProps {
  content: string | null
}

/**
 * About (docs/public-redesign/about-contact.md, designs/about-*.dc.html): the title and a serif
 * lead, then the editor's text as labelled sections, one per H2 (the heading is the small caps
 * label on the left, the text runs on the right), and the "See the work for yourself" band.
 */
export const AboutPage = ({ content }: AboutPageProps) => {
  const sections = content ? splitAtH2(content) : []
  return (
    <PageLayout>
      <div className={styles.page}>
        <PageIntro title="About" subtitle="A space for art, dialogue and experimentation." lead />

        <div className={styles.sections}>
          {sections.map((section, index) => {
            // The editor's text has no heading above its opening paragraphs: they get the
            // spec's first label (about-contact.md), like every other section.
            const label = section.heading ?? (index === 0 ? FIRST_SECTION_LABEL : null)
            return label ? (
              <TextSection key={index} label={label} className={styles.row}>
                <RichText content={section.html} variant="page" className={styles.text} />
              </TextSection>
            ) : (
              // A later section under an empty heading has no label: it runs in the text column alone.
              <div key={index} className={`${styles.row} ${styles.unlabelled}`}>
                <RichText content={section.html} variant="page" className={styles.text} />
              </div>
            )
          })}
        </div>

        <Band
          heading="See the work for yourself"
          action={
            <ArrowLinkRow>
              <ArrowLink href="/exhibitions">View exhibitions</ArrowLink>
              <ArrowLinkDivider />
              <ArrowLink href="/artists">Meet the artists</ArrowLink>
            </ArrowLinkRow>
          }
        />
      </div>
    </PageLayout>
  )
}
