'use client'

import type { ReactNode } from 'react'

import styles from './AdminPageHeader.module.scss'

type AdminPageHeaderProps = {
  /** Small caps line above the title (e.g. today's date). */
  eyebrow?: ReactNode
  title: string
  description?: ReactNode
  /** Right-aligned controls; they wrap under the title below 900px. */
  actions?: ReactNode
}

/** The admin page title block (dashboard.dc.html, PageHeader). */
export function AdminPageHeader({ eyebrow, title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
