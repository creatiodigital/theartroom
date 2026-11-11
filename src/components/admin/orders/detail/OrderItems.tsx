'use client'

import { Fragment } from 'react'

import { Panel } from '@/components/admin/ui/Panel'
import { editionTypeLabel } from '@/lib/editions/editionLabel'
import { formatEuro } from '@/lib/print-providers/format'
import type { SpecsSummary } from '@/lib/print-providers/specs'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import { PayoutStatus } from './PayoutStatus'

import styles from './OrderDetail.module.scss'

type ItemLine = {
  key: string
  title: string
  artist: string
  editionName: string | null
  editionLabels: string[]
  quantity: number | null
  specs: SpecsSummary
  productionCents: number
  artistCents: number
  galleryCents: number
  paidOutAt: string | null
  transferStatus: string | null
}

/**
 * Cart orders: one line per PrintOrderItem, whose money, payout and edition
 * numbers are authoritative (the header columns are deprecated rollups).
 * Legacy single-print orders: one line built from the header, which IS the
 * authoritative source there.
 */
function itemLines(order: Detail): ItemLine[] {
  if (order.isCart) {
    return order.items.map((it) => ({
      key: it.id,
      title: it.artworkTitle,
      artist: it.artistName,
      editionName: it.editionName,
      editionLabels: it.editionLabels,
      quantity: it.quantity,
      specs: it.specsSummary,
      productionCents: it.productionCents,
      artistCents: it.artistCents,
      galleryCents: it.galleryCents,
      paidOutAt: it.paidOutAt,
      transferStatus: it.transferStatus,
    }))
  }
  return [
    {
      key: order.id,
      title: order.artwork.title ?? order.artwork.slug ?? order.artwork.id,
      artist: order.artist.name,
      editionName: null,
      editionLabels: [],
      quantity: null,
      specs: order.specs,
      productionCents: order.productionCents,
      artistCents: order.artistCents,
      galleryCents: order.galleryCents,
      paidOutAt: order.paidOutAt,
      transferStatus: order.transferStatus,
    },
  ]
}

/** "Items · n prints": what was bought, its specs, and each line's money (orders.md §2). */
export function OrderItems({ order }: { order: Detail }) {
  const lines = itemLines(order)
  const count = lines.length

  return (
    <Panel
      title={`Items · ${count} ${count === 1 ? 'print' : 'prints'}`}
      subtitle={order.isCart ? 'Each artist is paid separately, per line.' : undefined}
    >
      <ul className={styles.lines}>
        {lines.map((line) => {
          const meta = [
            line.artist,
            line.editionName ? `${editionTypeLabel('limited')} · ${line.editionName}` : null,
          ].filter(Boolean)
          return (
            <li key={line.key} className={styles.line}>
              <div className={styles.lineMain}>
                <div>
                  <div className={styles.lineTitle}>{line.title}</div>
                  <div className={styles.lineMeta}>
                    {meta.join(' · ')}
                    {line.editionLabels.length > 0 && (
                      <>
                        {' · '}
                        <span className={styles.mono}>#{line.editionLabels.join(', #')}</span>
                      </>
                    )}
                    {line.quantity !== null && ` · Qty ${line.quantity}`}
                  </div>
                </div>
                {line.specs.length > 0 ? (
                  <dl className={styles.specs}>
                    {line.specs.map((s) => (
                      <div key={s.id}>
                        <dt>{s.label}</dt>
                        <dd>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className={styles.muted}>—</div>
                )}
              </div>
              <dl className={styles.lineMoney}>
                {(
                  [
                    ['TPS', formatEuro(line.productionCents)],
                    ['Artist', formatEuro(line.artistCents)],
                    ['Gallery', formatEuro(line.galleryCents)],
                  ] as const
                ).map(([label, value]) => (
                  <Fragment key={label}>
                    <dt>{label}</dt>
                    <dd className={styles.amount}>{value}</dd>
                  </Fragment>
                ))}
                <dt>Payout</dt>
                <dd>
                  <PayoutStatus paidOutAt={line.paidOutAt} transferStatus={line.transferStatus} />
                </dd>
              </dl>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
