'use client'

import { Button } from '@/components/ui/Button'

import detail from './ArtworkDetail.module.scss'

/**
 * The artwork pages' Inquire, for image works and Objects alike (owner, 2026-11-25: "Don't you have
 * the same component for all??"): the outlined button. It opens the info column's actions block,
 * whose divider is above it, or follows Order a print in the print block. Its look comes from the
 * info column (`.info .inquire`).
 */
export function ArtworkInquire({ onClick }: { onClick: () => void }) {
  return <Button variant="secondary" label="Inquire" className={detail.inquire} onClick={onClick} />
}
