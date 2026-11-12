import { HomeSectionHead } from '@/components/landing/HomeSectionHead/HomeSectionHead'
import { RichText } from '@/components/ui/RichText'
import type { HomepageAnnouncement } from '@/lib/queries/getHomepageAnnouncement'

import styles from './Announcement.module.scss'

/**
 * "Announcements" on the homepage (AR-174; docs/public-redesign/home.md §4), written in admin →
 * Content → Announcements: the photo 3:2 on the left, the title and text on the right. No button:
 * the text carries its own links. The board's red label ("Open call") has no field in the
 * announcement, so there is none (questions.md Q-P23).
 */
export const Announcement = ({ announcement }: { announcement: HomepageAnnouncement }) => (
  <section className={styles.section}>
    <HomeSectionHead title="Announcements" rule />
    <article className={styles.row}>
      {/* A plain <img>, as the slideshow uses: already-processed WebP on R2. */}
      <img
        src={announcement.imageUrl}
        alt=""
        className={styles.image}
        loading="lazy"
        decoding="async"
      />
      <div className={styles.content}>
        <h3 className={styles.title}>{announcement.title}</h3>
        {announcement.content && (
          <RichText content={announcement.content} variant="compact" className={styles.text} />
        )}
      </div>
    </article>
  </section>
)
