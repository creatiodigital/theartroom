'use client'

import Link from 'next/link'
import c from 'classnames'

import { blurOnPointerClick } from './blurOnPointerClick'
import type { ShellTone } from './ShellFrame'

import styles from './ShellWordmark.module.scss'

type ShellWordmarkProps = {
  /** The line next to or under "The Art Room": "Admin", "Artist studio". */
  tag: string
  tone: ShellTone
  /** `menu` = side menu (24px name), `bar` = top bar and drawer header (20px). */
  size: 'menu' | 'bar'
  /** `stacked` = tag under the name; `inline` = tag beside it, on the baseline. */
  layout: 'stacked' | 'inline'
  /** A link home; without it the wordmark is plain text (the drawer header). */
  href?: string
}

/** "The Art Room" + its tag, for every menu of the admin and the studio. */
export function ShellWordmark({ tag, tone, size, layout, href }: ShellWordmarkProps) {
  const className = c(styles.wordmark, styles[tone], styles[size], styles[layout])
  const content = (
    <>
      <span className={styles.name}>The Art Room</span>
      <span className={styles.tag}>{tag}</span>
    </>
  )

  if (!href) return <span className={className}>{content}</span>
  return (
    <Link href={href} className={className} onClick={blurOnPointerClick}>
      {content}
    </Link>
  )
}
