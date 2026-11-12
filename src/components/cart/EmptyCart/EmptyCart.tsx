import { ArrowLink } from '@/components/ui/ArrowLink'

import styles from './EmptyCart.module.scss'

/** docs/public-redesign/other-screens.md "Empty cart": the cart's and the checkout's empty state. */
export const EmptyCart = () => (
  <div className={styles.empty}>
    <p className={styles.emptyTitle}>Your cart is empty.</p>
    <p className={styles.emptyLine}>
      Every print is made to order on archival fine-art paper and arrives with a Certificate of
      Authenticity.
    </p>
    <div className={styles.emptyLinks}>
      <ArrowLink href="/prints">Browse the prints</ArrowLink>
      <ArrowLink href="/exhibitions">Visit the exhibitions</ArrowLink>
    </div>
  </div>
)
