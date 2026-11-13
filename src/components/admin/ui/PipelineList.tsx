'use client'

import Link from 'next/link'
import c from 'classnames'

import type { Bucket } from '@/lib/orders/orderBuckets'

import { Bar } from './Bar'

import styles from './PipelineList.module.scss'

// The fulfillment stages in order: BUCKET_ORDER without canceled, refunded and
// needs-attention. Labels are the Orders page's tab titles.
const STAGES: { bucket: Bucket; label: string }[] = [
  { bucket: 'new', label: 'New' },
  { bucket: 'to-place', label: 'To place at TPS' },
  { bucket: 'at-tps', label: 'At TPS' },
  { bucket: 'production', label: 'In production' },
  { bucket: 'shipped', label: 'Shipped' },
  { bucket: 'delivered', label: 'Delivered' },
  { bucket: 'done', label: 'Artist paid' },
]

type PipelineListProps = {
  /** null while loading or after a failed read: every count shows "–". */
  buckets: Record<Bucket, number> | null
  /** Where a row or pill leads, e.g. the Orders page on that stage's tab. */
  stageHref: (bucket: Bucket) => string
}

/** The order pipeline (components.md, PipelineList). */
export function PipelineList({ buckets, stageHref }: PipelineListProps) {
  const max = buckets ? Math.max(1, ...STAGES.map((s) => buckets[s.bucket])) : 1
  const canceled = buckets?.cancelled ?? null
  const refunded = buckets?.refunded ?? null

  return (
    <>
      <ol className={styles.list}>
        {STAGES.map((stage, i) => {
          const n = buckets ? buckets[stage.bucket] : null
          return (
            <li key={stage.bucket} className={styles.item}>
              <Link href={stageHref(stage.bucket)} className={styles.row}>
                <span aria-hidden className={styles.step}>
                  {i + 1}
                </span>
                <span className={styles.label}>{stage.label}</span>
                <span className={styles.bar}>
                  <Bar value={n ?? 0} max={max} />
                </span>
                <span className={c(styles.count, n !== null && n > 0 && styles.countActive)}>
                  {n ?? '–'}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      <div className={styles.pills}>
        <Link
          href={stageHref('cancelled')}
          className={c(styles.pill, canceled !== null && canceled > 0 && styles.pillRed)}
        >
          Canceled · {canceled ?? '–'}
        </Link>
        <Link href={stageHref('refunded')} className={styles.pill}>
          Refunded · {refunded ?? '–'}
        </Link>
      </div>
    </>
  )
}
