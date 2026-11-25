'use client'

import { Button } from '@/components/ui/Button'

import detail from './ArtworkDetail.module.scss'
import styles from './ArtworkInquire.module.scss'

/**
 * The artwork pages' Inquire, for image works and Objects alike (owner, 2026-11-25: "Don't you have
 * the same component for all??"): the outlined button, and with `divided` the divider above it,
 * where it follows the work's facts (nothing to buy). Under Order a print it comes without one.
 * Its look comes from the info column (`.info .inquire`).
 */
export function ArtworkInquire({
  onClick,
  divided = false,
}: {
  onClick: () => void
  divided?: boolean
}) {
  return (
    <>
      {divided && <span aria-hidden className={styles.divider} />}
      <Button variant="secondary" label="Inquire" className={detail.inquire} onClick={onClick} />
    </>
  )
}
