'use client'

import { useId } from 'react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './OrderDetail.module.scss'

type TestDataPanelProps = {
  error: string | null
  /** Opens the "Delete this order?" confirm. */
  onDelete: () => void
}

/**
 * Dev/staging ONLY (the caller checks DEV_CLEANUP_ALLOWED). In production orders
 * are never deleted: they are business records (Stripe cross-reference, audit
 * trail, disputes) — 'Cancelled' is the terminal state there, and an invoiced
 * order is corrected via credit note. The server action enforces this too;
 * hiding the panel is just honest UI. Shown in every order state.
 */
export function TestDataPanel({ error, onDelete }: TestDataPanelProps) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={styles.testData}>
      <div className={styles.testDataHead}>
        <h2 id={titleId} className={styles.testDataTitle}>
          Test data
        </h2>
        <span className={styles.stagingBadge}>Staging only</span>
      </div>
      <p className={styles.panelText}>
        Test-data cleanup ({process.env.NEXT_PUBLIC_APP_ENV ?? 'development'} only — not available
        in production). Permanently deletes this order, its event history, its invoices and their
        PDFs, and returns its edition numbers to the pool.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <Button
        variant="bare"
        font="dashboard"
        className={c(styles.btn, styles.btnDangerOutline, styles.btnSelfStart)}
        label="Delete order"
        onClick={onDelete}
      />
    </section>
  )
}
