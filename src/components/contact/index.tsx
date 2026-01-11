'use client'

import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import styles from './Contact.module.scss'

export const ContactPage = () => {
  return (
    <PageLayout>
      <Text as="h1" className={styles.title}>Contact us</Text>
      <div className={styles.contactInfo}>
        <div className={styles.top}>
          <a href="tel:+34665059941">T (+34) 665 05 99 41</a>
          <a href="mailto:contact@thefoundation.gallery">contact@thefoundation.gallery</a>
        </div>
        <Text as="p" font="sans">Monday - Friday, 10 am - 6 pm</Text>
      </div>
    </PageLayout>
  )
}
