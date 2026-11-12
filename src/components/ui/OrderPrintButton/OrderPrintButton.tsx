import Link from 'next/link'
import c from 'classnames'
// The SSR entry: grids render on the server as well as the client.
import { ShoppingBagOpen } from '@phosphor-icons/react/dist/ssr'

import styles from './OrderPrintButton.module.scss'

/**
 * The one "Order print" button under every printable work (docs/public-redesign/README.md "Order
 * print"): outlined, 38px, the header cart's bag, ORDER PRINT. Same link as today's (the artwork
 * page, never straight to the wizard). Not rendered by callers when the work has no print.
 */
export const OrderPrintButton = ({ href, className }: { href: string; className?: string }) => (
  <Link href={href} className={c(styles.button, className)}>
    <ShoppingBagOpen size={16} weight="light" aria-hidden />
    Order print
  </Link>
)
