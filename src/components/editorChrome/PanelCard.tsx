'use client'

import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './PanelCard.module.scss'

type PanelCardProps = {
  /** `card`: a 600 title (h3); `group`: an 11px caps caption (h4). */
  title?: string
  /**
   * card: a top-level grey card in a panel's body (Floor, View, a bench); group: a white
   * sub-card inside a section (Lighting's "All lamps", "Each lamp").
   */
  level: 'card' | 'group'
  /** On the head's right, e.g. "10 on · pick one to adjust". */
  aside?: ReactNode
  children: ReactNode
}

/** A card of rows in a tool panel (designs/editor-3d.dc.html, editor-3d-panels.dc.html). */
export function PanelCard({ title, level, aside, children }: PanelCardProps) {
  const Heading = level === 'card' ? 'h3' : 'h4'

  return (
    <div className={c(styles.root, styles[level])}>
      {(title || aside) && (
        <div className={styles.head}>
          {title && <Heading className={styles.title}>{title}</Heading>}
          {aside && <span className={styles.aside}>{aside}</span>}
        </div>
      )}
      {children}
    </div>
  )
}
