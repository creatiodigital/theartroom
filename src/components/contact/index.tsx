import { ArrowLink } from '@/components/ui/ArrowLink'
import { PageIntro } from '@/components/ui/PageIntro'
import { PageLayout } from '@/components/ui/PageLayout'
import { TextSection } from '@/components/ui/TextSection'

import styles from './Contact.module.scss'

const EMAIL = 'contact@theartroom.gallery'

/**
 * Contact (docs/public-redesign/about-contact.md, designs/contact-*.dc.html): the title and a serif
 * lead, then labelled rows like About: Email and Locations as short serif values, the reading
 * paragraphs under them in Lato (smaller than the values, as the owner set them on 2026-11-10).
 * No form.
 */
export const ContactPage = () => {
  return (
    <PageLayout>
      <div className={styles.page}>
        <PageIntro title="Contact" subtitle="For inquiries, exhibitions and collaborations." lead />

        <div className={styles.rows}>
          <TextSection label="Email" className={styles.row}>
            <div className={styles.stack}>
              <span className={styles.value}>{EMAIL}</span>
              <ArrowLink href={`mailto:${EMAIL}`}>Write to us</ArrowLink>
            </div>
          </TextSection>

          <TextSection label="Locations" className={styles.row}>
            <span className={styles.value}>Madrid · Vienna</span>
          </TextSection>

          <TextSection label="General inquiries" className={styles.row}>
            <p className={styles.paragraph}>
              The Art Room welcomes inquiries about exhibitions, artworks and prints, and artist
              collaborations.
            </p>
          </TextSection>

          <TextSection label="Exhibition proposals" className={styles.row}>
            <div className={styles.stack}>
              <p className={styles.paragraph}>
                The Art Room is accepting exhibition proposals from artists anywhere in the world,
                working in any medium. Write to us with:
              </p>
              <ul className={styles.list}>
                <li>a short introduction about you and your practice,</li>
                <li>a link to your portfolio, or a selection of images,</li>
                <li>a few words about the body of work you would like to show.</li>
              </ul>
              <p className={styles.paragraph}>
                Every proposal is reviewed by the gallery, and exhibitions are subject to
                acceptance.
              </p>
              <ArrowLink
                href={`mailto:${EMAIL}?subject=${encodeURIComponent('Exhibition proposal')}`}
              >
                Send a proposal
              </ArrowLink>
            </div>
          </TextSection>

          <TextSection label="Partnerships" className={styles.row}>
            <p className={styles.paragraph}>
              For institutional partnerships and curatorial inquiries, write to the same address.
            </p>
          </TextSection>
        </div>
      </div>
    </PageLayout>
  )
}
