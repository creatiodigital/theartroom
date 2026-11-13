'use client'

import { Fragment, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './AdminBreadcrumb.module.scss'

export type AdminBreadcrumbItem = {
  label: ReactNode
  /** Every item but the last links somewhere; the last one is the current page. */
  href?: string
  /** Geist Mono, e.g. an order reference. */
  mono?: boolean
}

type AdminBreadcrumbProps = {
  items: AdminBreadcrumbItem[]
}

/**
 * "Orders / E8ACA170" above the title of a page that is not itself a menu
 * destination (questions.md Q4). Phones show only the parent, as "← Orders".
 */
export function AdminBreadcrumb({ items }: AdminBreadcrumbProps) {
  const parentIndex = items.length - 2
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, i) => {
          const current = i === items.length - 1
          return (
            <Fragment key={i}>
              {i > 0 && (
                <li aria-hidden className={styles.separator}>
                  /
                </li>
              )}
              <li
                aria-current={current ? 'page' : undefined}
                className={c(
                  styles.item,
                  current && styles.current,
                  i === parentIndex && styles.parent,
                  item.mono && styles.mono,
                )}
              >
                {current || !item.href ? (
                  item.label
                ) : (
                  <Link href={item.href} className={styles.link}>
                    <ArrowLeft size={14} weight="light" aria-hidden className={styles.back} />
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
