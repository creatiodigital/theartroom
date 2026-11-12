import type { ReactNode } from 'react'

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
}: {
  heading: string
  line?: ReactNode
  action?: ReactNode
}) => (
  <section className={styles.band}>
    <div className={styles.inner}>
      <div className={styles.text}>
        <h2 className={styles.heading}>{heading}</h2>
        {line && <p className={styles.line}>{line}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  </section>
)
