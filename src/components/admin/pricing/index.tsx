'use client'

import { useState } from 'react'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatDisplayPrice } from '@/lib/editions/formatDisplayPrice'
import {
  galleryCommissionCents,
  gallerySharePct,
  isValidGalleryCommissionPct,
} from '@/lib/galleryCommission'

import { saveGalleryCommission } from '@/app/admin/settings/actions'

import styles from './AdminPricing.module.scss'

/** The example's artist price (pricing.md: "Artist's price €200"). */
const EXAMPLE_ARTIST_CENTS = 20000

/** 25 → "25%", 27.5 → "27.5%", 28.57… → "28.6%". */
const pctLabel = (pct: number) => `${Number(pct.toFixed(1))}%`

/** "18 Nov 2026", as the admin's other dates. */
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** What the admin typed, as a percent: "30", "27.5" or "27,5". NaN when it isn't a number. */
const parsePct = (text: string) =>
  text.trim() === '' ? NaN : Number(text.trim().replace(',', '.'))

const exampleFor = (pct: number) => {
  const commission = galleryCommissionCents(EXAMPLE_ARTIST_CENTS, pct / 100)
  return { commission, artwork: EXAMPLE_ARTIST_CENTS + commission }
}

/** The two commissions (owner 2026-11-20: "I will choose the % separately"). */
type Kind = 'open' | 'limited'
type Pcts = Record<Kind, number>

const KINDS: { kind: Kind; label: string; id: string }[] = [
  { kind: 'open', label: 'Open editions', id: 'gallery-commission-open' },
  { kind: 'limited', label: 'Limited editions', id: 'gallery-commission-limited' },
]

const INVALID = 'Enter a number from 0 to 100, with one decimal at most.'

type AdminPricingProps = {
  /** Open editions' commission as stored (pricing.md). */
  pct: number
  /** Limited editions' commission as stored (the open one until the first save of both). */
  limitedPct: number
  /** The last save, ISO; null until the first one. */
  changedAt: string | null
  /** The server couldn't read the setting and the percents are its fallback. */
  readFailed: boolean
}

/**
 * Admin › Sales › Pricing (docs/admin-redesign/pricing.md, designs/admin-pricing*.dc.html): the
 * gallery's commission, added on top of every artist's price — one for open editions, one for
 * limited editions (owner 2026-11-20). One Save for both, which asks first; the change reaches every
 * price on the site at once.
 */
export function AdminPricing({ pct, limitedPct, changedAt, readFailed }: AdminPricingProps) {
  const [saved, setSaved] = useState<{ pcts: Pcts; changedAt: string | null }>({
    pcts: { open: pct, limited: limitedPct },
    changedAt,
  })
  const [text, setText] = useState<Record<Kind, string>>({
    open: String(pct),
    limited: String(limitedPct),
  })
  // Silent until Save (the app's form rule): the error shows on Save and clears once fixed;
  // typing never adds one.
  const [invalid, setInvalid] = useState<Record<Kind, boolean>>({ open: false, limited: false })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message?: string
  } | null>(null)

  const typed: Pcts = { open: parsePct(text.open), limited: parsePct(text.limited) }
  const valid: Record<Kind, boolean> = {
    open: isValidGalleryCommissionPct(typed.open),
    limited: isValidGalleryCommissionPct(typed.limited),
  }
  const dirty =
    text.open.trim() !== String(saved.pcts.open) ||
    text.limited.trim() !== String(saved.pcts.limited)
  // The example keeps the last valid figure while a field holds something else.
  const shown: Pcts = {
    open: valid.open ? typed.open : saved.pcts.open,
    limited: valid.limited ? typed.limited : saved.pcts.limited,
  }
  const changes = KINDS.filter(({ kind }) => valid[kind] && typed[kind] !== saved.pcts[kind])

  const onSave = () => {
    if (!valid.open || !valid.limited) {
      setInvalid({ open: !valid.open, limited: !valid.limited })
      return
    }
    if (changes.length === 0) {
      // "30.0" for a saved 30: nothing to change.
      setText({ open: String(saved.pcts.open), limited: String(saved.pcts.limited) })
      return
    }
    setConfirmOpen(true)
  }

  const onConfirm = async () => {
    if (!valid.open || !valid.limited) return
    setBusy(true)
    const res = await saveGalleryCommission({ pct: typed.open, limitedPct: typed.limited }).catch(
      () => ({ ok: false as const, error: 'The commission wasn’t saved. Please try again.' }),
    )
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) {
      const pcts = { open: res.pct, limited: res.limitedPct }
      setSaved({ pcts, changedAt: res.changedAt })
      setText({ open: String(pcts.open), limited: String(pcts.limited) })
      setFeedback({
        tone: 'success',
        message: `Open editions now use a ${pctLabel(pcts.open)} commission, limited editions ${pctLabel(pcts.limited)}.`,
      })
    } else {
      setFeedback({ tone: 'error', message: res.error })
    }
  }

  const example = { open: exampleFor(shown.open), limited: exampleFor(shown.limited) }
  const before = { open: exampleFor(saved.pcts.open), limited: exampleFor(saved.pcts.limited) }

  return (
    <div className={styles.page}>
      <AdminPageHeader
        eyebrow="Sales"
        title="Pricing"
        description="How the gallery’s commission is added to each print price."
      />

      {feedback && (
        <div className={styles.feedback}>
          <FeedbackBar tone={feedback.tone} onDismiss={() => setFeedback(null)}>
            {feedback.tone === 'success' ? (
              <>
                <strong>Saved.</strong> {feedback.message}
              </>
            ) : (
              feedback.message
            )}
          </FeedbackBar>
        </div>
      )}

      {readFailed && (
        <div className={styles.feedback}>
          <Callout tone="red" title="The saved commission couldn’t be read.">
            Prices are using {pctLabel(pct)} for open editions and {pctLabel(limitedPct)} for
            limited editions until it can. Reload the page before changing it.
          </Callout>
        </div>
      )}

      <section className={styles.card} aria-labelledby="gallery-commission-title">
        <div className={styles.cardHead}>
          <h2 id="gallery-commission-title" className={styles.cardTitle}>
            Gallery commission
          </h2>
          <span className={styles.cardSub}>
            Added on top of each artist’s price, for every artist. Open and limited editions each
            have their own.
          </span>
        </div>

        <form
          className={styles.row}
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
        >
          {KINDS.map(({ kind, label, id }) => (
            <div key={kind} className={styles.field}>
              <label htmlFor={id} className={styles.label}>
                {label}
              </label>
              <div className={styles.inputWrap}>
                <Input
                  id={id}
                  type="text"
                  inputMode="decimal"
                  size="bare"
                  inputClassName={styles.input}
                  value={text[kind]}
                  invalid={invalid[kind]}
                  onChange={(e) => {
                    const value = e.target.value
                    setText((t) => ({ ...t, [kind]: value }))
                    if (invalid[kind] && isValidGalleryCommissionPct(parsePct(value))) {
                      setInvalid((v) => ({ ...v, [kind]: false }))
                    }
                  }}
                  autoComplete="off"
                />
                <span className={styles.suffix} aria-hidden="true">
                  %
                </span>
              </div>
            </div>
          ))}
          <Button
            type="submit"
            variant="bare"
            font="dashboard"
            className={styles.save}
            disabled={!dirty || busy}
          >
            Save
          </Button>
          {dirty ? (
            <span className={styles.unsaved}>
              Not saved yet. Currently {pctLabel(saved.pcts.open)} and{' '}
              {pctLabel(saved.pcts.limited)}.
            </span>
          ) : (
            <span className={styles.meta}>
              {saved.changedAt ? `Last changed ${dateLabel(saved.changedAt)}.` : 'Not changed yet.'}
            </span>
          )}
        </form>
        {(invalid.open || invalid.limited) && (
          <p className={styles.error} role="alert">
            {INVALID}
          </p>
        )}

        <div className={styles.example} aria-live="polite">
          <span className={styles.exampleTitle}>Example</span>
          <span aria-hidden="true" />
          <span className={styles.exampleHead}>Open edition</span>
          <span className={styles.exampleHead}>Limited edition</span>

          <span className={styles.exampleLabel}>Artist’s price</span>
          <span className={styles.exampleValue}>{formatDisplayPrice(EXAMPLE_ARTIST_CENTS)}</span>
          <span className={styles.exampleValue}>{formatDisplayPrice(EXAMPLE_ARTIST_CENTS)}</span>

          <span className={styles.exampleLabel}>Gallery commission</span>
          <span className={styles.exampleValue}>
            {formatDisplayPrice(example.open.commission)} ({pctLabel(shown.open)})
          </span>
          <span className={styles.exampleValue}>
            {formatDisplayPrice(example.limited.commission)} ({pctLabel(shown.limited)})
          </span>

          <span className={styles.exampleTotalLabel}>Artwork price</span>
          <span className={styles.exampleTotalValue}>{formatDisplayPrice(example.open.artwork)}</span>
          <span className={styles.exampleTotalValue}>
            {formatDisplayPrice(example.limited.artwork)}
          </span>

          <span className={styles.exampleNote}>
            The buyer also pays the print, shipping and VAT, and the price is rounded up to a whole
            euro. The gallery keeps {pctLabel(gallerySharePct(shown.open))} of an open
            edition’s artwork price and {pctLabel(gallerySharePct(shown.limited))} of a limited
            edition’s.
          </span>
        </div>

        <p className={styles.footnote}>
          A change applies at once to every price on the site and to carts at checkout. Orders
          already placed keep the price they were paid at, and the artists’ payouts don’t change.
        </p>
      </section>

      {confirmOpen && valid.open && valid.limited && (
        <AdminConfirmModal
          title={
            changes.length === 2
              ? 'Change both gallery commissions?'
              : `Change the ${changes[0].label.toLowerCase()} commission to ${pctLabel(typed[changes[0].kind])}?`
          }
          message={`Every ${
            changes.length === 2 ? '' : `${changes[0].kind} edition `
          }print price on the site changes now. With the example artist price of ${formatDisplayPrice(
            EXAMPLE_ARTIST_CENTS,
          )}, ${changes
            .map(
              ({ kind }) =>
                `${kind === 'open' ? 'an open' : 'a limited'} edition’s artwork price goes from ${formatDisplayPrice(
                  before[kind].artwork,
                )} to ${formatDisplayPrice(example[kind].artwork)} (${pctLabel(typed[kind])})`,
            )
            .join(', and ')}. Orders already placed don’t change.`}
          confirmLabel={changes.length === 2 ? 'Change both' : `Change to ${pctLabel(typed[changes[0].kind])}`}
          cancelLabel="Cancel"
          busyLabel="Saving…"
          busy={busy}
          icon={null}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={onConfirm}
        />
      )}
    </div>
  )
}
