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

type AdminPricingProps = {
  /** The commission as stored (pricing.md). */
  pct: number
  /** Its last save, ISO; null until the first one. */
  changedAt: string | null
  /** The server couldn't read the setting and `pct` is its fallback. */
  readFailed: boolean
}

/**
 * Admin › Sales › Pricing (docs/admin-redesign/pricing.md, designs/admin-pricing*.dc.html): the
 * gallery's commission, added on top of every artist's price. Save asks first; the change reaches
 * every price on the site at once.
 */
export function AdminPricing({ pct, changedAt, readFailed }: AdminPricingProps) {
  const [saved, setSaved] = useState({ pct, changedAt })
  const [text, setText] = useState(String(pct))
  // Silent until Save (the app's form rule): the error shows on Save and clears once fixed;
  // typing never adds one.
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    pct?: number
    message?: string
  } | null>(null)

  const typed = parsePct(text)
  const valid = isValidGalleryCommissionPct(typed)
  const dirty = text.trim() !== String(saved.pct)
  const shownPct = valid ? typed : saved.pct
  const example = exampleFor(shownPct)

  const onSave = () => {
    if (!valid) {
      setFieldError('Enter a number from 0 to 100, with one decimal at most.')
      return
    }
    if (typed === saved.pct) {
      // "30.0" for a saved 30: nothing to change.
      setText(String(saved.pct))
      return
    }
    setConfirmOpen(true)
  }

  const onConfirm = async () => {
    if (!valid) return
    setBusy(true)
    const res = await saveGalleryCommission(typed).catch(() => ({
      ok: false as const,
      error: 'The commission wasn’t saved. Please try again.',
    }))
    setBusy(false)
    setConfirmOpen(false)
    if (res.ok) {
      setSaved({ pct: res.pct, changedAt: res.changedAt })
      setText(String(res.pct))
      setFeedback({ tone: 'success', pct: res.pct })
    } else {
      setFeedback({ tone: 'error', message: res.error })
    }
  }

  const before = exampleFor(saved.pct)

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
                <strong>Saved.</strong> Prices now use a {pctLabel(feedback.pct ?? saved.pct)}{' '}
                commission.
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
            Prices are using {pctLabel(pct)} until it can. Reload the page before changing it.
          </Callout>
        </div>
      )}

      <section className={styles.card} aria-labelledby="gallery-commission-title">
        <div className={styles.cardHead}>
          <h2 id="gallery-commission-title" className={styles.cardTitle}>
            Gallery commission
          </h2>
          <span className={styles.cardSub}>
            Added on top of each artist’s price, for every artist and every print.
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
          <div className={styles.field}>
            <label htmlFor="gallery-commission" className={styles.label}>
              Commission
            </label>
            <div className={styles.inputWrap}>
              <Input
                id="gallery-commission"
                type="text"
                inputMode="decimal"
                size="bare"
                inputClassName={styles.input}
                value={text}
                invalid={!!fieldError}
                onChange={(e) => {
                  setText(e.target.value)
                  if (fieldError && isValidGalleryCommissionPct(parsePct(e.target.value))) {
                    setFieldError(null)
                  }
                }}
                autoComplete="off"
              />
              <span className={styles.suffix} aria-hidden="true">
                %
              </span>
            </div>
          </div>
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
            <span className={styles.unsaved}>Not saved yet. Currently {pctLabel(saved.pct)}.</span>
          ) : (
            <span className={styles.meta}>
              {saved.changedAt ? `Last changed ${dateLabel(saved.changedAt)}.` : 'Not changed yet.'}
            </span>
          )}
        </form>
        {fieldError && (
          <p className={styles.error} role="alert">
            {fieldError}
          </p>
        )}

        <div className={styles.example} aria-live="polite">
          <span className={styles.exampleTitle}>Example</span>
          <span className={styles.exampleLabel}>Artist’s price</span>
          <span className={styles.exampleValue}>{formatDisplayPrice(EXAMPLE_ARTIST_CENTS)}</span>
          <span className={styles.exampleLabel}>Gallery commission ({pctLabel(shownPct)})</span>
          <span className={styles.exampleValue}>{formatDisplayPrice(example.commission)}</span>
          <span className={styles.exampleTotalLabel}>Artwork price</span>
          <span className={styles.exampleTotalValue}>{formatDisplayPrice(example.artwork)}</span>
          <span className={styles.exampleNote}>
            The buyer also pays the print, shipping and VAT. The gallery keeps{' '}
            {pctLabel(gallerySharePct(shownPct))} of the artwork price.
          </span>
        </div>

        <p className={styles.footnote}>
          A change applies at once to every price on the site and to carts at checkout. Orders
          already placed keep the price they were paid at, and the artists’ payouts don’t change.
        </p>
      </section>

      {confirmOpen && valid && (
        <AdminConfirmModal
          title={`Change the gallery commission to ${pctLabel(typed)}?`}
          message={`Every print price on the site changes now. With the example artist price of ${formatDisplayPrice(
            EXAMPLE_ARTIST_CENTS,
          )}, the artwork price goes from ${formatDisplayPrice(before.artwork)} to ${formatDisplayPrice(
            example.artwork,
          )}. Orders already placed don’t change.`}
          confirmLabel={`Change to ${pctLabel(typed)}`}
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
