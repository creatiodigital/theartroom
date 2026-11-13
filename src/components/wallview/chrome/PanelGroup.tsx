'use client'

import { useId, type ReactNode } from 'react'

import styles from './PanelGroup.module.scss'

type PanelGroupProps = {
  /** The 11px caps caption (h3). Without one, the group is only its rows. */
  title?: string
  aside?: ReactNode
  /**
   * A locked item: the rows are dimmed and the mouse can't reach them, exactly as the collapsible
   * section they sat in before (ui/Section's `disabled`). Controls that pass their own `disabled`
   * still do.
   */
  disabled?: boolean
  children: ReactNode
}

/** An always-visible group of the right panel (wallview.md §3: groups instead of collapsibles). */
export function PanelGroup({ title, aside, disabled, children }: PanelGroupProps) {
  const titleId = useId()
  const body = (
    <div
      className={styles.body}
      style={disabled ? { pointerEvents: 'none' as const, opacity: 0.5 } : undefined}
    >
      {children}
    </div>
  )

  if (!title) return <div className={styles.group}>{body}</div>

  return (
    <section aria-labelledby={titleId} className={styles.group}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          {title}
        </h3>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      {body}
    </section>
  )
}
