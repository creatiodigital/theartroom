import Link from 'next/link'
import c from 'classnames'

import styles from './OrderPrintButton.module.scss'

/**
 * The one "Order print" button under every printable work (docs/public-redesign/README.md "Order
 * print"): outlined, 38px, ORDER PRINT, no icon (owner, 2026-11-12: the bag removed everywhere).
 * Same link as today's (the artwork page, never straight to the wizard). Not rendered by callers
 * when the work has no print.
 */
export const OrderPrintButton = ({ href, className }: { href: string; className?: string }) => (
  <Link href={href} className={c(styles.button, className)}>
    Order print
  </Link>
)
