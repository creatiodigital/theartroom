import type { ReactNode } from 'react'

import styles from './PageIntro.module.scss'

type PageIntroProps = {
  title: string
  subtitle?: ReactNode
  /** The order flow's title (designs/cart.dc.html, checkout-*): 48 px, less air above and below. */
  compact?: boolean
}

/**
 * The redesigned public pages' title and line (designs/exhibitions-desktop.dc.html and the other
 * list pages): EB Garamond 52 (38 on phones), Lato 18 #555. Pages not redesigned yet keep PageHeader.
 */
export const PageIntro = ({ title, subtitle, compact = false }: PageIntroProps) => (
  <header className={compact ? `${styles.intro} ${styles.compact}` : styles.intro}>
    <h1 className={styles.title}>{title}</h1>
    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
  </header>
)
