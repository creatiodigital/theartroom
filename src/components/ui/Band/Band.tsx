import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './Band.module.scss'

/**
 * docs/public-redesign/components.md "Band": a full-width off-white section with a serif heading,
 * a line, and the action on the right (under the text on phones): "Walk through the exhibition",
 * the feedback band, "See the work for yourself", "Many more works are available as prints".
 */
export const Band = ({
  heading,
  line,
  action,
  align = 'split',
}: {
  heading: string
  line?: ReactNode
  action?: ReactNode
  /** `center`: heading, line and action stacked and centred (the homepage's feedback band). */
  align?: 'split' | 'center'
}) => (
  // `data-band`: PageLayout drops its bottom padding when a page ends on a band.
  <section className={styles.band} data-band="">
    <div className={c(styles.inner, align === 'center' && styles.center)}>
      <div className={styles.text}>
        <h2 className={styles.heading}>{heading}</h2>
        {line && <p className={styles.line}>{line}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  </section>
)
