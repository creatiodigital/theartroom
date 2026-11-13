import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './TextSection.module.scss'

/**
 * docs/public-redesign/components.md "TextSection": a small grey caps label on the left (360px),
 * readable text on the right (up to 760px); one column on phones, the label first. The exhibition
 * page (About the exhibition), the artist page, About and Contact.
 */
export const TextSection = ({
  label,
  children,
  className,
  variant = 'default',
}: {
  label: string
  children: ReactNode
  className?: string
  /**
   * `columns`: the text spans the right two thirds (under the artist page's photo, which takes the
   * same share) in two columns, one on phones (owner, 2026-11-12).
   */
  variant?: 'default' | 'columns'
}) => (
  <section className={c(styles.section, variant === 'columns' && styles.columns, className)}>
    <h2 className={styles.label}>{label}</h2>
    <div className={styles.text}>{children}</div>
  </section>
)
