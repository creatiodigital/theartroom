'use client'

import { useId, type ReactNode } from 'react'
import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './Panel.module.scss'

type PanelProps = {
  title: string
  subtitle?: ReactNode
  /** Right side of the header, e.g. a PanelLink. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** White admin card with a caps title (components.md, Panel). */
export function Panel({ title, subtitle, action, children, className }: PanelProps) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={c(styles.panel, className)}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The panel header's "All orders >" link: outlined on desktop, plain text on phone. */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.link}>
      {children}
      <CaretRight size={14} weight="light" aria-hidden className={styles.linkIcon} />
    </Link>
  )
}
