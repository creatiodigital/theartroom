'use client'

import c from 'classnames'

import { CopyField } from '@/components/admin/ui/CopyField'
import { Panel } from '@/components/admin/ui/Panel'
import { countryName } from '@/utils/countryName'

import type { AdminOrderDetail as Detail } from '@/app/admin/orders/actions'

import type { ShippingAddress } from './orderDetailModel'

import styles from './OrderDetail.module.scss'

type TpsPlacementProps = {
  order: Detail
  addr: ShippingAddress
  /** Exactly what "Copy address" puts on the clipboard. */
  recipientCopy: string
}

/**
 * Everything theprintspace's "Order Prints" form asks for, one Copy per field
 * (orders.md §2). No "Open theprintspace" link until the owner gives the URL (Q13).
 */
export function TpsPlacement({ order, addr, recipientCopy }: TpsPlacementProps) {
  return (
    <Panel
      title="For TPS placement"
      subtitle={<>Paste these into theprintspace&apos;s &ldquo;Order Prints&rdquo; form.</>}
    >
      {/* Cart orders: one specs block per line (each is its own TPS order).
          Legacy single-print orders: the single header-derived specs block. */}
      {order.isCart
        ? order.items.map((it) => (
            <div key={it.id} className={styles.tpsBlock}>
              <span className={styles.tpsBlockHead}>
                {it.artworkTitle} · {it.artistName}
                {it.quantity > 1 ? ` · ×${it.quantity}` : ''}
              </span>
              {it.specsSummary.length > 0 ? (
                <>
                  {it.editionLabels.length > 0 && (
                    <CopyField
                      className={styles.tpsRow}
                      label="Edition"
                      value={it.editionLabels.join(', ')}
                      copyValue={it.editionLabels.join(', ')}
                    />
                  )}
                  {it.editionName && (
                    <CopyField
                      className={styles.tpsRow}
                      label="Variant"
                      value={it.editionName}
                      copyValue={it.editionName}
                    />
                  )}
                  {it.specsSummary.map((s) => (
                    <CopyField
                      key={s.id}
                      className={styles.tpsRow}
                      label={s.label}
                      value={s.value}
                      copyValue={s.value}
                    />
                  ))}
                </>
              ) : (
                <p className={c(styles.tpsRow, styles.tpsNote)}>
                  Specs unavailable — see the raw printConfig in the timeline payload.
                </p>
              )}
            </div>
          ))
        : order.specs.length > 0 && (
            <div className={styles.tpsBlock}>
              <span className={styles.tpsBlockHead}>
                {order.artwork.title ?? '(untitled)'} · {order.artist.name}
              </span>
              {order.specs.map((s) => (
                <CopyField
                  key={s.id}
                  className={styles.tpsRow}
                  label={s.label}
                  value={s.value}
                  copyValue={s.value}
                />
              ))}
            </div>
          )}

      <div className={styles.tpsBlock}>
        <CopyField
          align="start"
          label="Recipient"
          value={
            <address className={styles.address}>
              {order.buyerName}
              <br />
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
            </address>
          }
          copyValue={recipientCopy}
          buttonLabel="Copy address"
        />
      </div>

      {order.assetUrl && (
        <div className={c(styles.tpsBlock, styles.assetRow)}>
          <span className={styles.assetLabel}>Print asset</span>
          <a
            href={order.assetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.textLink}
          >
            Open original
          </a>
        </div>
      )}
    </Panel>
  )
}
