import styles from './SectionHeading.module.scss'

/**
 * docs/public-redesign/components.md "SectionHeading": a series (or Works, Exhibitions) heading in
 * serif small caps, centred between two hairlines, the count in grey under it ("10 works").
 */
export const SectionHeading = ({ title, count }: { title: string; count?: string }) => (
  <div className={styles.heading}>
    <h2 className={styles.title} data-section-heading>
      {title}
    </h2>
    {count && <span className={styles.count}>{count}</span>}
  </div>
)
