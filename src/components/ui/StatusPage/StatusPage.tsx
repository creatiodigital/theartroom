import type { ReactNode } from 'react'

import styles from './StatusPage.module.scss'

/**
 * The 404 and error pages (docs/public-redesign/other-screens.md "404" and "Error",
 * designs/remaining-screens.dc.html): inside the normal header and footer, left-aligned with the
 * content column and centred between them; a small grey caps label, a serif title, one line, then
 * the actions. No images.
 */
export const StatusPage = ({
  label,
  title,
  line,
  actions,
}: {
  label: string
  title: string
  line: string
  actions: ReactNode
}) => (
  <section className={styles.page}>
    <span className={styles.label}>{label}</span>
    <h1 className={styles.title}>{title}</h1>
    <p className={styles.line}>{line}</p>
    <div className={styles.actions}>{actions}</div>
  </section>
)
