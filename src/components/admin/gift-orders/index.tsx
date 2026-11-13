'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Copy } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminCheckbox } from '@/components/admin/ui/AdminCheckbox'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { CopyButton } from '@/components/admin/ui/CopyField'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { OffPlatformKindMark } from '@/components/admin/ui/OffPlatformKindMark'
import { RowMenu, type RowMenuItem } from '@/components/admin/ui/RowMenu'
import { SegmentedControl } from '@/components/admin/ui/SegmentedControl'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

import {
  advanceOffPlatformOrder,
  cancelOffPlatformOrder,
  deleteCancelledOffPlatformOrder,
  listOffPlatformOrders,
  markOffPlatformArtistPaid,
  updateOffPlatformTrackingUrl,
  type OffPlatformOrderRow,
} from '@/app/admin/orders/actions'
import {
  OFF_PLATFORM_KINDS,
  OFF_PLATFORM_KIND_LABELS,
  type OffPlatformKind,
} from '@/lib/orders/offPlatformKinds'

import styles from './GiftOrders.module.scss'

/** Stage flow mirrors PrintOrder's manual TPS pipeline (null = pending placement). */
const STAGES: { value: string | null; label: string; nextLabel: string }[] = [
  { value: null, label: 'To place at TPS', nextLabel: '' },
  { value: 'Placed', label: 'Placed', nextLabel: 'Mark placed at TPS' },
  { value: 'Started', label: 'In production', nextLabel: 'Production started' },
  { value: 'Shipped', label: 'Shipped', nextLabel: 'Mark shipped' },
  { value: 'Complete', label: 'Delivered', nextLabel: 'Mark delivered' },
]

const stageIndex = (status: string | null) => STAGES.findIndex((s) => s.value === status)

/**
 * Whether cancelling still returns the edition number to the pool. From
 * 'Started' onward a physical print carrying that number exists, so the number
 * stays consumed — otherwise the same copy could be sold to a buyer too, and
 * two prints would bear e.g. 29/50. Mirrors `stageAllowsEditionRelease` on the
 * server, which is the actual guard; this only keeps the wording honest.
 */
const cancelReleasesNumber = (status: string | null) => stageIndex(status) < 2

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })

const PAGE_PATH = '/admin/gift-orders'

// The Kind filter (sales.md §2): client-side over the loaded rows, kept in the
// URL as ?kind= so a filtered view survives Back and can be linked (Q23).
const KIND_FILTERS: { id: OffPlatformKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'gift', label: 'Gallery gifts' },
  { id: 'artist_copy', label: 'Artist copies' },
  { id: 'test', label: 'Test prints' },
]

const isKind = (value: string | null): value is OffPlatformKind =>
  value !== null && (OFF_PLATFORM_KINDS as readonly string[]).includes(value)

// "Hide delivered" is remembered per browser, not per link (sales.md §2, Q23).
const HIDE_DELIVERED_KEY = 'admin.giftOrders.hideDelivered'

const giftOrders = (n: number) => `${n} ${n === 1 ? 'gift order' : 'gift orders'}`

/** "city, country" under the recipient's name; the full address goes out through Copy address. */
const placeOf = (o: OffPlatformOrderRow) =>
  o.recipientAddress
    ? [o.recipientAddress.city, o.recipientAddress.country].filter(Boolean).join(', ')
    : o.recipientCountry

/** What "Copy address for TPS" copies: name / line1 / line2 / "postal city" / state / country / phone. */
const tpsAddressText = (o: OffPlatformOrderRow) => {
  const a = o.recipientAddress
  if (!a) return ''
  const text = [
    o.recipientName,
    a.line1,
    a.line2,
    `${a.postalCode} ${a.city}`,
    a.state,
    a.country,
    a.phone,
  ]
    .filter(Boolean)
    .join('\n')
  return text
}

/**
 * Off-platform orders — gifts, artist copies, test prints. Parcels produced
 * at TPS outside the paid pipeline: no Stripe, no invoice, no payout, no
 * buyer emails. Same manual fulfillment stages as regular orders so the
 * admin keeps control of every physical print in circulation.
 */
export const AdminGiftOrders = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<OffPlatformOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Shipped needs a tracking URL prompt; cancel needs a confirm.
  const [shipTarget, setShipTarget] = useState<OffPlatformOrderRow | null>(null)
  const [shipTracking, setShipTracking] = useState('')
  // "Edit tracking link" (row menu): the same field, on a shipped / delivered parcel.
  const [trackingTarget, setTrackingTarget] = useState<OffPlatformOrderRow | null>(null)
  const [trackingDraft, setTrackingDraft] = useState('')
  const [cancelTarget, setCancelTarget] = useState<OffPlatformOrderRow | null>(null)
  const [payTarget, setPayTarget] = useState<OffPlatformOrderRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OffPlatformOrderRow | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  const kindParam = searchParams.get('kind')
  const kindFilter: OffPlatformKind | '' = isKind(kindParam) ? kindParam : ''
  const setKindFilter = useCallback(
    (kind: OffPlatformKind | '') => {
      router.replace(kind ? `${PAGE_PATH}?kind=${kind}` : PAGE_PATH, { scroll: false })
    },
    [router],
  )

  // On by default; the stored choice is read after mount (storage does not
  // exist on the server, and can throw in private modes).
  const [hideDelivered, setHideDelivered] = useState(true)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HIDE_DELIVERED_KEY)
      if (stored !== null) setHideDelivered(stored === '1')
    } catch {
      // Storage unavailable: the default stands.
    }
  }, [])
  const changeHideDelivered = (next: boolean) => {
    setHideDelivered(next)
    try {
      localStorage.setItem(HIDE_DELIVERED_KEY, next ? '1' : '0')
    } catch {
      // Storage unavailable: the choice lasts for this visit only.
    }
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const t = session?.user?.userType
      if (t !== 'admin' && t !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  const load = useCallback(async () => {
    setError(null)
    const res = await listOffPlatformOrders()
    if (res.ok) setOrders(res.orders)
    else setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (sessionStatus === 'authenticated') load()
  }, [sessionStatus, load])

  const advance = async (order: OffPlatformOrderRow, stage: string, trackingUrl?: string) => {
    setBusyId(order.id)
    setModalError(null)
    const res = await advanceOffPlatformOrder(order.id, stage, { trackingUrl })
    setBusyId(null)
    if (res.ok) {
      setShipTarget(null)
      setShipTracking('')
      await load()
    } else {
      setModalError(res.error)
      if (!shipTarget) setError(res.error)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setBusyId(cancelTarget.id)
    setModalError(null)
    const res = await cancelOffPlatformOrder(cancelTarget.id)
    setBusyId(null)
    if (res.ok) {
      setCancelTarget(null)
      await load()
    } else {
      setModalError(res.error)
    }
  }

  const handleMarkPaid = async () => {
    if (!payTarget) return
    setBusyId(payTarget.id)
    setModalError(null)
    const res = await markOffPlatformArtistPaid(payTarget.id)
    setBusyId(null)
    if (res.ok) {
      setPayTarget(null)
      await load()
    } else {
      setModalError(res.error)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    setModalError(null)
    const res = await deleteCancelledOffPlatformOrder(deleteTarget.id)
    setBusyId(null)
    if (res.ok) {
      setDeleteTarget(null)
      await load()
    } else {
      setModalError(res.error)
    }
  }

  // NEW (questions.md Q21 (a)): sets or clears the link, the stage stays.
  const handleSaveTracking = async () => {
    if (!trackingTarget) return
    setBusyId(trackingTarget.id)
    setModalError(null)
    const res = await updateOffPlatformTrackingUrl(trackingTarget.id, trackingDraft)
    setBusyId(null)
    if (res.ok) {
      setTrackingTarget(null)
      setTrackingDraft('')
      await load()
    } else {
      setModalError(res.error)
    }
  }

  // ── Render-only derivations ──
  // Canceled rows stay visible whatever the filters; Hide delivered only
  // drops 'Complete'.
  const visibleOrders = useMemo(() => {
    let rows = orders
    if (kindFilter) rows = rows.filter((o) => o.kind === kindFilter)
    if (hideDelivered) rows = rows.filter((o) => o.fulfillmentStatus !== 'Complete')
    return rows
  }, [orders, kindFilter, hideDelivered])
  // The first read failed: nothing is known, so the list gives way to the
  // error (a failed re-read or stage step keeps the rows it had).
  const loadFailed = !loading && error !== null && orders.length === 0
  const listed = !loading && orders.length > 0

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Sales"
        title="Gift orders"
        description="Gifts, artist copies and test prints, produced at TPS outside the paid pipeline."
      />

      <Callout tone="info" title="No payment, invoice or buyer emails.">
        The edition number is used up in the ledger and the parcel goes through the same stages as
        an order. To create one, use <strong>Create gift order</strong> on any on-sale variant of an
        artwork.
      </Callout>

      {error && <Callout tone="red">{error}</Callout>}

      {!loadFailed && (
        <ListPanel
          label="Gift orders"
          toolbar={
            listed ? (
              <div className={styles.filters}>
                <SegmentedControl
                  label="Kind"
                  options={KIND_FILTERS}
                  value={kindFilter || 'all'}
                  onChange={(id) => setKindFilter(id === 'all' ? '' : id)}
                />
                <AdminCheckbox
                  id="gift-hide-delivered"
                  label="Hide delivered"
                  checked={hideDelivered}
                  onChange={changeHideDelivered}
                />
              </div>
            ) : undefined
          }
          count={listed ? giftOrders(visibleOrders.length) : undefined}
        >
          {loading ? (
            <p className={styles.loading}>Loading…</p>
          ) : orders.length === 0 ? (
            <EmptyState
              title="No gift orders yet."
              text={
                <>
                  Create one from <strong>Create gift order</strong> on an artwork&apos;s variant.
                </>
              }
            />
          ) : visibleOrders.length === 0 ? (
            <EmptyState
              title="No gift orders match these filters."
              text={hideDelivered ? 'Delivered gift orders are hidden.' : undefined}
            />
          ) : (
            <DataTable className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Copy</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Status</th>
                  <th scope="col">Artist fee</th>
                  <th scope="col" className={styles.alignRight}>
                    Next step
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((o) => {
                  const idx = stageIndex(o.fulfillmentStatus)
                  const cancelled = o.fulfillmentStatus === 'Cancelled'
                  const next =
                    !cancelled && idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null
                  const place = placeOf(o)
                  // The ⋮ menu, in today's conditions for Cancel and Delete; Edit
                  // tracking link (NEW) once the parcel has shipped.
                  const menuItems: RowMenuItem[] = []
                  if (
                    !cancelled &&
                    (o.fulfillmentStatus === 'Shipped' || o.fulfillmentStatus === 'Complete')
                  ) {
                    menuItems.push({
                      id: 'tracking',
                      label: 'Edit tracking link',
                      onSelect: () => {
                        setModalError(null)
                        setTrackingDraft(o.trackingUrl ?? '')
                        setTrackingTarget(o)
                      },
                    })
                  }
                  if (!cancelled) {
                    menuItems.push({
                      id: 'cancel',
                      label: 'Cancel gift order…',
                      onSelect: () => {
                        setModalError(null)
                        setCancelTarget(o)
                      },
                    })
                  }
                  if (cancelled) {
                    menuItems.push({
                      id: 'delete',
                      label: 'Delete…',
                      tone: 'danger',
                      onSelect: () => {
                        setModalError(null)
                        setDeleteTarget(o)
                      },
                    })
                  }
                  return (
                    <tr key={o.id} className={c(styles.row, cancelled && styles.canceled)}>
                      <td className={styles.cellDate}>{formatDate(o.createdAt)}</td>
                      <td className={styles.cellKind}>
                        <span className={styles.kind}>
                          <OffPlatformKindMark kind={o.kind} />
                          {OFF_PLATFORM_KIND_LABELS[o.kind as OffPlatformKind] ?? o.kind}
                        </span>
                      </td>
                      <td className={styles.cellCopy}>
                        {o.copies.map((copy) => (
                          <div key={`${copy.artworkTitle}-${copy.number}`} className={styles.copy}>
                            <div className={styles.title}>{copy.artworkTitle}</div>
                            <div className={styles.sub}>
                              {copy.variantName} ·{' '}
                              <span className={styles.number}>
                                {copy.number}/{copy.editionSize}
                              </span>
                            </div>
                          </div>
                        ))}
                      </td>
                      <td className={styles.cellRecipient}>
                        <div className={styles.recipient}>{o.recipientName}</div>
                        {place && <div className={styles.sub}>{place}</div>}
                        {o.note && <div className={styles.sub}>{o.note}</div>}
                        {o.recipientAddress && (
                          <div className={styles.copyAddress}>
                            <CopyButton
                              size="compact"
                              icon={Copy}
                              label="Copy address for TPS"
                              value={tpsAddressText(o)}
                            />
                          </div>
                        )}
                      </td>
                      <td className={styles.cellStatus}>
                        <StatusPill
                          shape="tag"
                          tone={cancelled ? 'outline' : idx === 0 ? 'dark' : 'gray'}
                          label={
                            cancelled
                              ? 'Canceled'
                              : (STAGES[idx]?.label ?? o.fulfillmentStatus ?? '')
                          }
                        />
                        {o.trackingUrl && (
                          <div className={styles.tracking}>
                            <a
                              href={o.trackingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.trackingLink}
                            >
                              Tracking<span aria-hidden> ↗</span>
                            </a>
                          </div>
                        )}
                      </td>
                      <td className={styles.cellFee}>
                        {o.artistCents > 0 ? (
                          <>
                            {o.artistPaidAt ? (
                              <div className={styles.paid}>Paid {formatDate(o.artistPaidAt)}</div>
                            ) : (
                              <div className={styles.unpaid}>Not paid</div>
                            )}
                            <div className={styles.sub}>€{(o.artistCents / 100).toFixed(2)}</div>
                            {o.artistPaidAt ? null : cancelled ? null : (
                              <Button
                                variant="bare"
                                font="dashboard"
                                className={styles.markPaid}
                                label="Mark paid…"
                                onClick={() => {
                                  setModalError(null)
                                  setPayTarget(o)
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <span className={styles.noFee}>No fee</span>
                        )}
                      </td>
                      <td className={styles.cellAction}>
                        <div className={styles.actions}>
                          {next && (
                            <Button
                              variant="bare"
                              font="dashboard"
                              className={styles.next}
                              label={next.nextLabel}
                              disabled={busyId === o.id}
                              onClick={() => {
                                if (next.value === 'Shipped') {
                                  setModalError(null)
                                  setShipTracking(o.trackingUrl ?? '')
                                  setShipTarget(o)
                                } else if (next.value) {
                                  advance(o, next.value)
                                }
                              }}
                            />
                          )}
                          <RowMenu
                            label={`Actions for ${o.recipientName}`}
                            disabled={busyId === o.id}
                            groups={[{ items: menuItems }]}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </DataTable>
          )}
        </ListPanel>
      )}

      {shipTarget && (
        <AdminConfirmModal
          icon={null}
          title="Mark shipped"
          message={
            <div className={styles.form}>
              <p>
                Marks <strong>{shipTarget.recipientName}</strong>&apos;s parcel as shipped. Paste
                the tracking link from The Print Space if there is one.
              </p>
              <div className={styles.field}>
                <label htmlFor="gift-tracking" className={styles.fieldLabel}>
                  Tracking link (optional)
                </label>
                <Input
                  id="gift-tracking"
                  type="text"
                  size="bare"
                  inputClassName={styles.input}
                  value={shipTracking}
                  onChange={(e) => setShipTracking(e.target.value)}
                  placeholder="https://… (optional)"
                />
              </div>
            </div>
          }
          warning={modalError}
          confirmLabel="Mark shipped"
          cancelLabel="Not yet"
          busy={busyId === shipTarget.id}
          onConfirm={() => advance(shipTarget, 'Shipped', shipTracking)}
          onCancel={() => {
            if (busyId) return
            setShipTarget(null)
            setModalError(null)
          }}
        />
      )}

      {trackingTarget && (
        <AdminConfirmModal
          icon={null}
          title="Edit tracking link"
          message={
            <div className={styles.form}>
              <p>
                The tracking link for <strong>{trackingTarget.recipientName}</strong>&apos;s parcel.
              </p>
              <div className={styles.field}>
                <label htmlFor="gift-tracking-edit" className={styles.fieldLabel}>
                  Tracking link (optional)
                </label>
                <Input
                  id="gift-tracking-edit"
                  type="text"
                  size="bare"
                  inputClassName={styles.input}
                  value={trackingDraft}
                  onChange={(e) => setTrackingDraft(e.target.value)}
                  placeholder="https://… (optional)"
                />
              </div>
            </div>
          }
          warning={modalError}
          confirmLabel="Save link"
          cancelLabel="Not yet"
          busy={busyId === trackingTarget.id}
          onConfirm={handleSaveTracking}
          onCancel={() => {
            if (busyId) return
            setTrackingTarget(null)
            setModalError(null)
          }}
        />
      )}

      {payTarget && (
        <AdminConfirmModal
          title="Mark artist fee as paid?"
          message={
            <>
              Confirms you transferred <strong>€{(payTarget.artistCents / 100).toFixed(2)}</strong>{' '}
              to <strong>{payTarget.copies[0]?.artistName ?? 'the artist'}</strong> for this gifted
              copy. Include it in the artist&apos;s monthly invoice batch.
            </>
          }
          warning={modalError}
          confirmLabel="Yes, mark paid"
          cancelLabel="Not yet"
          busy={busyId === payTarget.id}
          onConfirm={handleMarkPaid}
          onCancel={() => {
            if (busyId) return
            setPayTarget(null)
            setModalError(null)
          }}
        />
      )}

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete this canceled gift order?"
          message={
            <>
              Permanently removes <strong>{deleteTarget.recipientName}</strong>&apos;s canceled{' '}
              {OFF_PLATFORM_KIND_LABELS[deleteTarget.kind as OffPlatformKind] ?? deleteTarget.kind}{' '}
              from the list. Its edition number was already released when it was canceled.
            </>
          }
          warning={modalError}
          confirmLabel="Yes, delete permanently"
          cancelLabel="Keep it"
          destructive
          busy={busyId === deleteTarget.id}
          onConfirm={handleDelete}
          onCancel={() => {
            if (busyId) return
            setDeleteTarget(null)
            setModalError(null)
          }}
        />
      )}

      {cancelTarget && (
        <AdminConfirmModal
          title="Cancel this gift order?"
          message={
            <>
              Cancels <strong>{cancelTarget.recipientName}</strong>&apos;s{' '}
              {OFF_PLATFORM_KIND_LABELS[cancelTarget.kind as OffPlatformKind] ?? cancelTarget.kind}
              {cancelReleasesNumber(cancelTarget.fulfillmentStatus) ? (
                <>
                  {' '}
                  and <strong>releases the edition number(s)</strong> back to available.
                </>
              ) : (
                <>
                  . The edition number <strong>stays consumed</strong>.
                </>
              )}
            </>
          }
          warning={
            modalError ? (
              modalError
            ) : !cancelReleasesNumber(cancelTarget.fulfillmentStatus) ? (
              <>
                Production has already started, so a physical print carrying this number exists. The
                number is <strong>not</strong> returned to the pool — releasing it would let the
                same copy be sold again and two prints would share a number.
              </>
            ) : stageIndex(cancelTarget.fulfillmentStatus) >= 1 ? (
              <>
                This parcel is already <strong>at or past placement</strong> — only cancel if the
                print was never produced, or the freed number could be printed twice.
              </>
            ) : null
          }
          confirmLabel="Yes, cancel it"
          cancelLabel="Keep it"
          destructive
          busy={busyId === cancelTarget.id}
          onConfirm={handleCancel}
          onCancel={() => {
            if (busyId) return
            setCancelTarget(null)
            setModalError(null)
          }}
        />
      )}
    </div>
  )
}
