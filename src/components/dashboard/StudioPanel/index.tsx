'use client'

import { useId, type ReactNode } from 'react'
import c from 'classnames'

import styles from './StudioPanel.module.scss'

type StudioPanelProps = {
  /** The panel's h2 (15px 700, sentence case, as the three designs draw it). */
  title: string
  /**
   * Base id (default: a generated one). The h2 is `{id}-title` and the
   * description `{id}-description`, so a page can point a control's
   * aria-labelledby / aria-describedby at them.
   */
  id?: string
  /** A 13px secondary line under the title. */
  description?: ReactNode
  /** Right of the title on a wide panel (a button, a counter); under it when narrow. */
  aside?: ReactNode
  /** row: the text left and the aside right, no body (Payouts' Disconnect). Default stack. */
  layout?: 'stack' | 'row'
  className?: string
  children?: ReactNode
}

/**
 * A white panel on the studio's form pages (artist.md §4–§6, artist-profile,
 * artist-payouts and artist-exhibition-settings .dc.html): an h2, an optional
 * line under it and an optional control beside it, then the panel's fields.
 * No z-index, transform or opacity, so dialogs and the fixed save bar paint as
 * they do elsewhere.
 */
export function StudioPanel({
  title,
  id,
  description,
  aside,
  layout = 'stack',
  className,
  children,
}: StudioPanelProps) {
  const autoId = useId()
  const baseId = id ?? autoId
  const titleId = `${baseId}-title`

  return (
    <section
      aria-labelledby={titleId}
      className={c(styles.panel, layout === 'row' && styles.row, className)}
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && (
            <p id={`${baseId}-description`} className={styles.description}>
              {description}
            </p>
          )}
        </div>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {children}
    </section>
  )
}
