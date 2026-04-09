'use client'

import Logo from '@/icons/logo.svg'

import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'
import styles from './Contact.module.scss'

const CorrespondenceBadge = () => (
  <div className={styles.badgeRow}>
    <div className={styles.badgeLine} />
    <div className={styles.badge}>
      <svg
        viewBox="0 0 400 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.badgeSvg}
      >
        <path
          d="M20 90 Q20 65 50 48 L180 4 Q200 -4 220 4 L350 48 Q380 65 380 90 Q380 115 350 132 L220 176 Q200 184 180 176 L50 132 Q20 115 20 90 Z"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M24 90 Q24 66 52 50 L181 8 Q200 1 219 8 L348 50 Q376 66 376 90 Q376 114 348 130 L219 172 Q200 179 181 172 L52 130 Q24 114 24 90 Z"
          stroke="currentColor"
          strokeWidth="0.5"
          fill="none"
        />
      </svg>
      <div className={styles.badgeContent}>
        <Logo className={styles.badgeLogo} />
        <div className={styles.badgeBottom}>
          <div className={styles.badgeDivider} />
          <Text as="span" size="xs" className={styles.badgeSubtitle}>
            CORRESPONDENCE
          </Text>
        </div>
      </div>
    </div>
    <div className={styles.badgeLine} />
  </div>
)

export const ContactPage = () => {
  return (
    <PageLayout>
      <CorrespondenceBadge />

      <div className={styles.grid}>
        <div className={styles.column}>
          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              EMAIL
            </Text>
            <a href="mailto:contact@theartroom.gallery" className={styles.email}>
              inquiries@theartroom.gallery
            </a>
          </div>

          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              LOCATION
            </Text>
            <Text className={styles.value}>Madrid, Spain</Text>
          </div>
        </div>

        <div className={styles.column}>
          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              CONTACT
            </Text>
            <Text as="p" font="serif" className={styles.value}>
              The Art Room welcomes inquiries related to exhibitions, artworks, and artist
              collaborations.
            </Text>
          </div>

          <div className={styles.section}>
            <Text as="span" size="xs" className={styles.label}>
              SUBMISSION
            </Text>
            <Text as="p" font="serif" className={styles.value}>
              Submissions and proposals are by invitation only.
            </Text>
            <Text as="p" size="sm" className={styles.note}>
              For institutional partnerships and curatorial inquiries, please direct correspondence
              to the email address above.
            </Text>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
