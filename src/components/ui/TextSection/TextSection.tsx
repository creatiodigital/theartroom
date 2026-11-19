import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './TextSection.module.scss'

/**
 * docs/public-redesign/components.md "TextSection": a small grey caps label on the left (360px),
 * the text on the right at the reading measure (`--measure`, readable-text.md); one column on
 * phones, the label first. About, Contact and the artwork page's About the work; the `columns`
 * variant on the exhibition page (About the exhibition) and the artist page.
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
   * `columns` (readable-text.md, final): the text in two columns of at most `--measure`, across the
   * full width with the label on top; from 1680 px the label in the left third and the columns in
   * the right two thirds (under the hero image); one column at 768 px and below.
   */
  variant?: 'default' | 'columns'
}) => (
  <section className={c(styles.section, variant === 'columns' && styles.columns, className)}>
    <h2 className={styles.label}>{label}</h2>
    <div className={styles.text}>{children}</div>
  </section>
)
