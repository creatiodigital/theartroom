import type { ReactNode } from 'react'
import Link from 'next/link'
import c from 'classnames'
// The SSR entry: these render inside server components as well as client ones.
import { ArrowLeft, ArrowRight, Cube } from '@phosphor-icons/react/dist/ssr'

import styles from './ArrowLink.module.scss'

const ICONS = { arrow: ArrowRight, back: ArrowLeft, cube: Cube } as const

type ArrowLinkProps = {
  href: string
  children: ReactNode
  /** `cube` for "Enter 3D room"; `back` for the order flow's "← Back to …" links. */
  icon?: keyof typeof ICONS
  /** `small`: Lato 14 with a 15 px icon, the cart's and checkout's links (designs/cart.dc.html). */
  size?: 'regular' | 'small'
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
  size = 'regular',
  className,
  newTab = false,
}: ArrowLinkProps) => {
  const Icon = ICONS[icon]
  return (
    <Link
      href={href}
      className={c(styles.link, size === 'small' && styles.small, className)}
      {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <Icon size={size === 'small' ? 15 : 18} weight="light" aria-hidden className={styles.icon} />
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
