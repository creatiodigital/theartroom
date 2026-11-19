import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './TextSection.module.scss'

/**
 * docs/public-redesign/components.md "TextSection": a small grey caps label, then the text at the
 * reading measure (readable-text.md: at most `--measure`, one column). The label sits on the left
 * (360px) from xl and on top below that; one column on phones. The exhibition page (About the
 * exhibition), the artist page, About, Contact and the artwork page's About the work.
 */
export const TextSection = ({
  label,
  children,
  className,
  variant = 'default',
  short = false,
}: {
  label: string
  children: ReactNode
  className?: string
  /**
   * `columns`: from xl the label takes the left third and the text the right two thirds (under the
   * artist page's photo, which takes the same share) (owner, 2026-11-12).
   */
  variant?: 'default' | 'columns'
  /**
   * `columns` only: the text is short (`isShortRichText`), so it may sit in two columns where each
   * can be `--measure-min` wide. A long text always stays in one column (readable-text.md rule 3).
   */
  short?: boolean
}) => (
  <section
    className={c(
      styles.section,
      variant === 'columns' && styles.columns,
      variant === 'columns' && short && styles.short,
      className,
    )}
  >
    <h2 className={styles.label}>{label}</h2>
    <div className={styles.text}>{children}</div>
  </section>
)
