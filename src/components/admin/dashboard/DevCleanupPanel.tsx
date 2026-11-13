'use client'

import { Button } from '@/components/ui/Button'

import styles from './AdminDashboard.module.scss'

type DevCleanupPanelProps = {
  /** NEXT_PUBLIC_APP_ENV, shown in the badge. */
  environment: string
  /** The last run's summary or error, under the panel. */
  result: string | null
  onClear: () => void
}

/**
 * Test-data cleanup, last on the dashboard and only where DEV_CLEANUP_ALLOWED
 * (dashboard-states.dc.html §6). Dashed and outline-red so it never looks like
 * the real Pause switch.
 */
export function DevCleanupPanel({ environment, result, onClear }: DevCleanupPanelProps) {
  return (
    <section className={styles.cleanup}>
      <div className={styles.cleanupBody}>
        <div className={styles.cleanupHead}>
          <span className={styles.envBadge}>Test environment · {environment}</span>
          <h2 className={styles.cleanupTitle}>Clear test data</h2>
        </div>
        <p className={styles.cleanupText}>
          Wipes all orders, invoices (and their PDFs), staged carts, and resets every
          limited-edition series. Localhost and staging share this database. Not shown in
          production.
        </p>
        {result && <p className={styles.cleanupResult}>{result}</p>}
      </div>
      <Button
        variant="bare"
        font="dashboard"
        className={styles.cleanupButton}
        label="Clear all test orders & invoices"
        onClick={onClear}
      />
    </section>
  )
}
