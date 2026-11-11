'use client'

import c from 'classnames'

import { Panel } from '@/components/admin/ui/Panel'

import type { AdminOrderEvent } from '@/app/admin/orders/actions'

import { eventDot, formatDateTime } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

const DOT_CLASS = {
  red: styles.eventRed,
  dark: styles.eventDark,
  mid: styles.eventMid,
  light: styles.eventLight,
} as const

/**
 * Every event on the order, newest first (the server sorts them). The raw
 * payloads stay available for debugging, behind one collapsed disclosure.
 */
export function OrderTimeline({ events }: { events: AdminOrderEvent[] }) {
  const withPayload = events.filter((e) => e.payload)

  return (
    <Panel title="Timeline">
      {events.length === 0 ? (
        <p className={styles.panelText}>No events recorded yet.</p>
      ) : (
        <ol className={styles.timeline}>
          {events.map((e) => (
            <li key={e.id} className={styles.event}>
              <span aria-hidden className={c(styles.eventDot, DOT_CLASS[eventDot(e.kind)])} />
              <div className={styles.eventText}>
                <span className={styles.eventMessage}>{e.message ?? '—'}</span>
                <span className={styles.eventMeta}>
                  {e.kind} · {e.actor}
                </span>
              </div>
              <time dateTime={e.at} className={styles.eventTime}>
                {formatDateTime(e.at)}
              </time>
            </li>
          ))}
        </ol>
      )}

      {withPayload.length > 0 && (
        <details className={styles.raw}>
          <summary className={styles.rawSummary}>Show raw event data</summary>
          <div className={styles.rawList}>
            {withPayload.map((e) => (
              <div key={e.id} className={styles.rawItem}>
                <span className={styles.eventMeta}>
                  {e.kind} · {formatDateTime(e.at)}
                </span>
                <pre className={styles.rawPre}>{JSON.stringify(e.payload, null, 2)}</pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  )
}
