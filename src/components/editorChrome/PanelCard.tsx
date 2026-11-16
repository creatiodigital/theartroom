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
  /**
   * A card whose switch is on and holds its settings, drawn white with a 1px dark outline
   * (docs/lightbox: the Lightbox card while on).
   */
  outlined?: boolean
  children: ReactNode
}

/** A card of rows in a tool panel (designs/editor-3d.dc.html, editor-3d-panels.dc.html). */
export function PanelCard({ title, level, aside, outlined, children }: PanelCardProps) {
  const Heading = level === 'card' ? 'h3' : 'h4'

  return (
    <div className={c(styles.root, styles[level], outlined && styles.outlined)}>
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
