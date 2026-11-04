import { NiceTitle } from '@/components/landing/NiceTitle/NiceTitle'
import { RichText } from '@/components/ui/RichText'
import { Text } from '@/components/ui/Typography'
import type { HomepageAnnouncement } from '@/lib/queries/getHomepageAnnouncement'

import styles from './Announcement.module.scss'

/**
 * "Announcements" on the homepage (AR-174), written in admin → Content → Announcements: the photo
 * on one half, in a 3:2 landscape frame, and the title and text on the other. No button: the text carries its own
 * links.
 */
export const Announcement = ({ announcement }: { announcement: HomepageAnnouncement }) => (
  <section className={styles.section}>
    <NiceTitle title="Announcements" />
    <div className={styles.row}>
      <div className={styles.photo}>
        {/* A plain <img>, as the slideshow uses: already-processed WebP on R2. */}
        <img
          src={announcement.imageUrl}
          alt=""
          className={styles.image}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className={styles.content}>
        <Text as="h3" font="serif" size="2xl" className={styles.title}>
          {announcement.title}
        </Text>
        {announcement.content && <RichText content={announcement.content} variant="compact" />}
      </div>
    </div>
  </section>
)
