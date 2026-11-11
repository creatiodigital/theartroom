'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DownloadSimple } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminCheckbox } from '@/components/admin/ui/AdminCheckbox'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Callout } from '@/components/admin/ui/Callout'
import { DataTable } from '@/components/admin/ui/DataTable'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { SearchField } from '@/components/admin/ui/SearchField'
import { StatCard } from '@/components/admin/ui/StatCard'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { formatOrderRef } from '@/lib/orders/orderRef'
import { formatEuro } from '@/lib/print-providers/format'

import { listInvoices, exportInvoiceRegisterCsv } from '@/app/admin/invoices/actions'
import type { InvoiceRow, InvoiceFilter } from '@/lib/invoices/queryInvoices'

import styles from './Invoices.module.scss'

// ── Date helpers ──────────────────────────────────────────────────────────────

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

// ── Year options for the filter select ───────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
// Show from 2026 (launch year) through to next year, so a fresh Jan always
// appears before any invoice is issued.
const YEAR_OPTIONS: number[] = []
for (let y = 2026; y <= CURRENT_YEAR + 1; y++) YEAR_OPTIONS.push(y)

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

// ── Totals (NEW: the cards and the tfoot row) ────────────────────────────────

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

type Totals = { base: number; vat: number; total: number; invoices: number; creditNotes: number }

/** Sums over rows the page already holds: no request. Credit notes are stored
 *  negative, so the totals come out net of them. */
const sumRows = (rows: InvoiceRow[]): Totals =>
  rows.reduce<Totals>(
    (t, inv) => ({
      base: t.base + inv.baseCents,
      vat: t.vat + inv.vatCents,
      total: t.total + inv.totalCents,
      invoices: t.invoices + (inv.type === 'invoice' ? 1 : 0),
      creditNotes: t.creditNotes + (inv.type === 'credit_note' ? 1 : 0),
    }),
    { base: 0, vat: 0, total: 0, invoices: 0, creditNotes: 0 },
  )

/** "November 2026", "2026" or "all years" (plan, Decision 7). */
const periodLabel = (year: number | undefined, month: number | undefined) => {
  if (year == null) return 'all years'
  const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label
  return monthLabel ? `${monthLabel} ${year}` : String(year)
}

// ── Main component ────────────────────────────────────────────────────────────

export const AdminInvoices = () => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  // Filter state
  const [yearFilter, setYearFilter] = useState<number | undefined>(undefined)
  const [monthFilter, setMonthFilter] = useState<number | undefined>(undefined)
  const [clientFilter, setClientFilter] = useState('')

  // Data state
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hide-voided toggle (view only — exports are unaffected)
  const [hideVoided, setHideVoided] = useState(false)

  // CSV export state
  const [exporting, setExporting] = useState(false)
  // ZIP export state
  const [zipping, setZipping] = useState(false)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    } else if (sessionStatus === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') router.push('/')
    }
  }, [sessionStatus, session, router])

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const filter: InvoiceFilter = {}
    if (yearFilter != null) filter.year = yearFilter
    if (monthFilter != null) filter.month = monthFilter
    if (clientFilter.trim()) filter.client = clientFilter.trim()

    const res = await listInvoices(filter)
    if (res.ok) setInvoices(res.invoices)
    else setError(res.error)
    setLoading(false)
  }, [yearFilter, monthFilter, clientFilter])

  useEffect(() => {
    if (sessionStatus === 'authenticated') void load()
  }, [sessionStatus, load])

  // ── CSV export ──────────────────────────────────────────────────────────────
  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const filter: InvoiceFilter = {}
      if (yearFilter != null) filter.year = yearFilter
      if (monthFilter != null) filter.month = monthFilter
      if (clientFilter.trim()) filter.client = clientFilter.trim()

      const res = await exportInvoiceRegisterCsv(filter)
      if (!res.ok) {
        alert(`Export failed: ${res.error}`)
        return
      }
      // Trigger browser download via a temporary Blob URL.
      const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ── ZIP export (all filtered invoice PDFs in one file) ────────────────────────
  const handleExportZip = async () => {
    setZipping(true)
    try {
      const params = new URLSearchParams()
      if (yearFilter != null) params.set('year', String(yearFilter))
      if (monthFilter != null) params.set('month', String(monthFilter))
      if (clientFilter.trim()) params.set('client', clientFilter.trim())

      const res = await fetch(`/admin/invoices/export/zip?${params.toString()}`)
      if (!res.ok) {
        alert(`ZIP export failed: ${await res.text()}`)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filename = disposition.match(/filename="(.+?)"/)?.[1] ?? 'AR-invoices.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipping(false)
    }
  }

  // ── Derived view (hide-voided filtering — exports always use full `invoices`) ──
  const visibleInvoices = hideVoided
    ? invoices.filter((inv) => !inv.voided && inv.type !== 'credit_note')
    : invoices

  // ── Render-only derivations ─────────────────────────────────────────────────
  // Decision 9: "Loading…" only while there is nothing to show yet. A reload
  // (every filter change, every keystroke in the search) keeps the rows, cards
  // and totals on screen and marks the list aria-busy.
  const firstLoading = loading && invoices.length === 0
  const reloading = loading && invoices.length > 0
  // Nothing was ever read: the list gives way to the error (a failed re-read
  // keeps the rows it had, as today).
  const loadFailed = !loading && error !== null && invoices.length === 0
  const totalsKnown = !firstLoading && !loadFailed

  const filtersActive = yearFilter != null || monthFilter != null || Boolean(clientFilter)
  const search = clientFilter.trim()
  // Q25 (a): the cards add up what the exports would export (year, month and
  // the client search; never Hide voided), so a search says so in the label.
  const scope = `${periodLabel(yearFilter, monthFilter)}${search ? ` · matching “${search}”` : ''}`
  const totalsCaptionId = useId()
  const exportTotals = sumRows(invoices)
  const shownTotals = sumRows(visibleInvoices)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Sales"
        title="Invoices"
        description="Every invoice and credit note the gallery has issued, for the accountant."
        actions={
          <>
            {/* CSV export */}
            <Button
              variant="bare"
              font="dashboard"
              className={styles.export}
              disabled={exporting || loading || invoices.length === 0}
              onClick={() => void handleExportCsv()}
            >
              <DownloadSimple size={16} weight="light" aria-hidden />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>

            {/* ZIP export — bundles the currently-filtered invoice PDFs. */}
            <Button
              variant="bare"
              font="dashboard"
              className={c(styles.export, styles.exportDark)}
              disabled={zipping || loading || invoices.length === 0}
              onClick={() => void handleExportZip()}
            >
              <DownloadSimple size={16} weight="light" aria-hidden />
              {zipping ? 'Zipping…' : 'Export PDFs (ZIP)'}
            </Button>
          </>
        }
      />

      <section aria-labelledby={totalsCaptionId} className={styles.totals}>
        <p id={totalsCaptionId} className={styles.caption}>
          Totals for {scope}
        </p>
        <div className={styles.cards}>
          <StatCard
            label="Invoiced"
            size="money"
            value={totalsKnown ? formatEuro(exportTotals.total) : null}
            hint="net of credit notes"
          />
          <StatCard
            label="Base"
            size="money"
            value={totalsKnown ? formatEuro(exportTotals.base) : null}
            hint="before VAT"
          />
          <StatCard
            label="VAT"
            size="money"
            value={totalsKnown ? formatEuro(exportTotals.vat) : null}
            hint="collected"
          />
          <StatCard
            label="Documents"
            // 28px like the money cards beside it (Q32).
            size="money"
            value={totalsKnown ? invoices.length : null}
            hint={
              totalsKnown
                ? `${plural(exportTotals.invoices, 'invoice', 'invoices')} · ${plural(
                    exportTotals.creditNotes,
                    'credit note',
                    'credit notes',
                  )}`
                : undefined
            }
          />
        </div>
      </section>

      {error && <Callout tone="red">{error}</Callout>}

      <ListPanel
        label="Invoices"
        toolbar={
          <div className={styles.filters}>
            <AdminSelect
              label="Year"
              hideLabel
              id="invoice-year"
              value={yearFilter != null ? String(yearFilter) : ''}
              onChange={(value) => {
                const next = value ? Number(value) : undefined
                setYearFilter(next)
                // Month depends on year: clearing the year must clear the
                // month too, or a disabled-but-still-applied month silently
                // filters the register AND both exports.
                if (next == null) setMonthFilter(undefined)
              }}
            >
              <option value="">All years</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </AdminSelect>

            {/* Month select — only enabled when a year is selected */}
            <AdminSelect
              label="Month"
              hideLabel
              id="invoice-month"
              value={monthFilter != null ? String(monthFilter) : ''}
              disabled={yearFilter == null}
              onChange={(value) => setMonthFilter(value ? Number(value) : undefined)}
            >
              <option value="">All months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </AdminSelect>

            <SearchField
              label="Search clients"
              placeholder="Client name or email"
              value={clientFilter}
              onChange={setClientFilter}
            />

            {filtersActive && (
              <Button
                variant="bare"
                font="dashboard"
                className={styles.clear}
                label="Clear filters"
                onClick={() => {
                  setYearFilter(undefined)
                  setMonthFilter(undefined)
                  setClientFilter('')
                }}
              />
            )}

            <AdminCheckbox
              id="hide-voided"
              label="Hide voided"
              checked={hideVoided}
              onChange={setHideVoided}
            />
          </div>
        }
        count={
          invoices.length > 0 ? plural(visibleInvoices.length, 'document', 'documents') : undefined
        }
        footnote="Exports always include voided invoices and their credit notes, which cancel each other out."
      >
        <div aria-busy={reloading || undefined}>
          {(() => {
            if (firstLoading) {
              return <p className={styles.loading}>Loading…</p>
            }
            if (loadFailed) return null
            if (invoices.length === 0) {
              return (
                <EmptyState
                  title={
                    filtersActive ? 'No invoices match the current filters.' : 'No invoices yet.'
                  }
                />
              )
            }
            if (visibleInvoices.length === 0) {
              return (
                <EmptyState title="All invoices are voided and hidden. Uncheck 'Hide voided' to see them." />
              )
            }
            return (
              <DataTable className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Date</th>
                    <th scope="col">Client</th>
                    <th scope="col">Order</th>
                    <th scope="col" className={styles.alignRight}>
                      Base
                    </th>
                    <th scope="col" className={styles.alignRight}>
                      VAT
                    </th>
                    <th scope="col" className={styles.alignRight}>
                      Total
                    </th>
                    <th scope="col">
                      <span className="sr-only">PDF</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInvoices.map((inv) => {
                    const creditNote = inv.type === 'credit_note'
                    return (
                      <tr key={inv.id} className={c(styles.row, inv.voided && styles.rowVoided)}>
                        <td className={styles.cellNumber}>
                          <div className={styles.numberLine}>
                            {/* The number's only copy on the page (invoice-ui.spec
                                finds it with a strict getByText). */}
                            <span className={c(styles.number, inv.voided && styles.numberVoided)}>
                              {inv.number}
                            </span>
                            <StatusPill
                              label={creditNote ? 'Credit note' : 'Invoice'}
                              tone={creditNote ? 'info' : 'gray'}
                              shape="tag"
                            />
                          </div>
                          {!creditNote && inv.voided && inv.rectifiedByNumber && (
                            <div className={c(styles.note, styles.noteVoided)}>
                              Voided by {inv.rectifiedByNumber}
                            </div>
                          )}
                          {creditNote && inv.correctsNumber && (
                            <div className={c(styles.note, styles.noteCancels)}>
                              Cancels {inv.correctsNumber}
                            </div>
                          )}
                        </td>
                        <td className={styles.cellDate}>{formatDate(inv.issuedAt)}</td>
                        <td className={styles.cellClient}>
                          <div className={styles.client}>{inv.buyerName}</div>
                          <div className={styles.email}>{inv.buyerEmail}</div>
                        </td>
                        <td className={styles.cellOrder}>
                          <Link href={`/admin/orders/${inv.orderId}`} className={styles.ref}>
                            <span className={styles.phoneOnly}>Order </span>
                            {formatOrderRef(inv.orderId)}
                          </Link>
                        </td>
                        <td className={c(styles.amount, styles.cellBase)}>
                          <span className={styles.phoneOnly}>Base </span>
                          {formatEuro(inv.baseCents)}
                        </td>
                        <td className={c(styles.amount, styles.cellVat)}>
                          <span className={styles.phoneOnly}>VAT </span>
                          {formatEuro(inv.vatCents)}
                        </td>
                        <td className={c(styles.amount, styles.cellTotal)}>
                          {formatEuro(inv.totalCents)}
                        </td>
                        <td className={styles.cellPdf}>
                          {/* No per-invoice delete, anywhere: the ORDER owns its
                              documents. Dev cleanup = delete the order (cascades
                              its invoices) or the dashboard's wipe-all button. */}
                          <Button
                            variant="bare"
                            font="dashboard"
                            className={styles.pdf}
                            href={`/admin/invoices/${inv.id}/download`}
                            // A file, not a page: never fetched before the click (Q33).
                            prefetch={false}
                            aria-label={`${inv.number} PDF`}
                          >
                            <DownloadSimple size={16} weight="light" aria-hidden />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className={styles.footRow}>
                    <th scope="row" colSpan={4} className={styles.footLabel}>
                      Total for {scope}
                    </th>
                    <td className={c(styles.amount, styles.cellBase)}>
                      <span className={styles.phoneOnly}>Base </span>
                      {formatEuro(shownTotals.base)}
                    </td>
                    <td className={c(styles.amount, styles.cellVat)}>
                      <span className={styles.phoneOnly}>VAT </span>
                      {formatEuro(shownTotals.vat)}
                    </td>
                    <td className={c(styles.amount, styles.cellTotal, styles.footTotal)}>
                      {formatEuro(shownTotals.total)}
                    </td>
                    <td className={styles.footEmpty} />
                  </tr>
                </tfoot>
              </DataTable>
            )
          })()}
        </div>
      </ListPanel>
    </div>
  )
}
