'use client'

import { Panel } from '@/components/admin/ui/Panel'
import { countryName } from '@/utils/countryName'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import type { ShippingAddress } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

/** Side column: who bought it and where it goes (orders.md §2). */
export function BuyerPanel({ order, addr }: { order: Detail; addr: ShippingAddress }) {
  return (
    <Panel title="Buyer" className={styles.sidePanel}>
      <div className={styles.buyerId}>
        <span className={styles.buyerName}>{order.buyerName || '—'}</span>
        {order.buyerEmail ? (
          <a href={`mailto:${order.buyerEmail}`} className={styles.textLink}>
            {order.buyerEmail}
          </a>
        ) : (
          <span>—</span>
        )}
      </div>
      <dl className={styles.facts}>
        <dt>Country</dt>
        <dd>{countryName(order.country) || '—'}</dd>
        <dt>Ships to</dt>
        <dd>
          {addr.line1}
          {addr.line2 ? `, ${addr.line2}` : ''}
          <br />
          {[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}
          <br />
          {countryName(addr.country)}
          {addr.phone ? (
            <>
              <br />
              {addr.phone}
            </>
          ) : null}
        </dd>
      </dl>
    </Panel>
  )
}
