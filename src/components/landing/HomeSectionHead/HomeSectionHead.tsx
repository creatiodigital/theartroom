import type { ReactNode } from 'react'
import c from 'classnames'

import { ArrowLink } from '@/components/ui/ArrowLink'

import styles from './HomeSectionHead.module.scss'

/**
 * A homepage section's heading row (docs/public-redesign/home.md; components.md "SectionHeading",
 * the left-aligned variant): the serif title, and an ArrowLink on the right ("All exhibitions").
 * `rule` draws the hairline above it, as the board does for Current exhibitions and Announcements.
 */
export const HomeSectionHead = ({
  title,
  link,
  rule = false,
}: {
  title: string
  /** `label` may hold a part that phones hide visually (kept for screen readers). */
  link?: { href: string; label: ReactNode }
  rule?: boolean
}) => (
  <div className={c(styles.head, rule && styles.rule)}>
    <h2 className={styles.title}>{title}</h2>
    {link && (
      <ArrowLink href={link.href} className={styles.link}>
        {link.label}
      </ArrowLink>
    )}
  </div>
)

/** Words in a heading link that phones hide visually ("All exhibitions" reads "All" there). */
export const WideOnly = ({ children }: { children: ReactNode }) => (
  <span className={styles.wideOnly}>{children}</span>
)
