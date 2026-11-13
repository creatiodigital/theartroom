import styles from './Intro.module.scss'

/**
 * The homepage's introduction (docs/public-redesign/home.md §2): the heading and the lead. The three
 * points the board draws under it are gone (owner, 2026-11-12).
 */
export const Intro = () => (
  <section className={styles.intro}>
    <div className={styles.text}>
      {/* Owner, 2026-11-12: today's tagline, in place of home.md's "Step inside the work." */}
      <h2 className={styles.heading}>Art beyond immediacy</h2>
      <p className={styles.lead}>
        The Art Room is an online gallery for contemporary art. Each exhibition is carefully
        curated, and can also be visited as a room you walk through, at your own pace.
      </p>
    </div>
  </section>
)
