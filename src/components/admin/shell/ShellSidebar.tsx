import type { ReactNode } from 'react'
import c from 'classnames'

import type { ShellTone } from './ShellFrame'

import styles from './ShellSidebar.module.scss'

type ShellSidebarProps = {
  tone: ShellTone
  /** The nav landmark's name: "Admin", "Artist". */
  label: string
  children: ReactNode
}

/** The side menu column, 900px and up. Its content is the admin's or the studio's. */
export function ShellSidebar({ tone, label, children }: ShellSidebarProps) {
  return (
    <nav aria-label={label} className={c(styles.sidebar, styles[tone])}>
      {children}
    </nav>
  )
}
