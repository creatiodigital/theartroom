'use client'

import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import styles from './Contact.module.scss'

export const ContactPage = () => {
  return (
    <PageLayout>
      <div className={styles.content}>
        <Text as="h1" font="serif" size="3xl" className={styles.title}>
          Contact us
        </Text>
        <Text as="p" size="sm" className={styles.intro}>
          We welcome inquiries about our exhibitions, artworks, and artist collaborations. Please
          reach out to discuss acquisitions, private viewings, or general questions.
        </Text>

        <div className={styles.section}>
          <Text as="span" size="xs" className={styles.label}>
            EMAIL
          </Text>
          <a href="mailto:contact@theartroom.gallery" className={styles.email}>
            contact@theartroom.gallery
          </a>
        </div>

        <div className={styles.section}>
          <Text as="span" size="xs" className={styles.label}>
            LOCATION
          </Text>
          <Text as="p" size="md" className={styles.value}>
            Madrid, Spain
          </Text>
        </div>

        <div className={styles.footer}>
          <Text as="p" size="sm" className={styles.note}>
            Submissions and proposals are by invitation only. For institutional partnerships and
            curatorial inquiries, please direct correspondence to the email address above.
          </Text>
        </div>
      </div>
    </PageLayout>
  )
}
