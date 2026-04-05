'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import styles from './Contact.module.scss'

export const ContactPage = () => {
  return (
    <PageLayout>
      <PageHeader
        pageTitle="Contact us"
        pageSubtitle="We welcome inquiries about our exhibitions, and artist collaborations."
      />

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
        <Text className={styles.value}>Madrid, Spain</Text>
      </div>

      <div className={styles.footer}>
        <Text as="p" size="md" className={styles.note}>
          Submissions and proposals are by invitation only. For institutional partnerships and
          curatorial inquiries, please direct correspondence to the email address above.
        </Text>
      </div>
    </PageLayout>
  )
}
