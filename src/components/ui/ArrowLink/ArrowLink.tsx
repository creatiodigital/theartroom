import type { ReactNode } from 'react'
import Link from 'next/link'
import c from 'classnames'
// The SSR entry: these render inside server components as well as client ones.
import { ArrowRight, Cube } from '@phosphor-icons/react/dist/ssr'

import styles from './ArrowLink.module.scss'

const ICONS = { arrow: ArrowRight, cube: Cube } as const

type ArrowLinkProps = {
  href: string
  children: ReactNode
  /** `cube` for "Enter 3D room". */
  icon?: keyof typeof ICONS
  className?: string
  /** Opens in a new tab, and says so to screen readers. */
  newTab?: boolean
}

/**
 * The public site's link (docs/public-redesign/components.md "ArrowLink"): the icon first
 * (ArrowRight, or Cube for the 3D room), then the label; never underlined.
 */
export const ArrowLink = ({
  href,
  children,
  icon = 'arrow',
  className,
  newTab = false,
}: ArrowLinkProps) => {
  const Icon = ICONS[icon]
  return (
    <Link
      href={href}
      className={c(styles.link, className)}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <Icon size={18} weight="light" aria-hidden className={styles.icon} />
      <span>{children}</span>
      {newTab && <span className="sr-only"> (opens in a new tab)</span>}
    </Link>
  )
}

/** ArrowLinks side by side, with `ArrowLinkDivider` between them ("→ View exhibition | Enter 3D room"). */
export const ArrowLinkRow = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => <div className={c(styles.row, className)}>{children}</div>

export const ArrowLinkDivider = () => <span aria-hidden className={styles.divider} />
