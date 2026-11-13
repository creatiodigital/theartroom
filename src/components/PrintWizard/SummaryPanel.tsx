'use client'

import { useEffect, useState } from 'react'
import { CaretRight, Info } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal/ConfirmModal'
import {
  type Catalog,
  type Quote,
  type WizardConfig,
  formatEuro,
  summarizeConfig,
} from '@/lib/print-providers'

import { SpecList } from '../print/SpecList/SpecList'
import type { WizardArtwork } from './index'

import styles from './PrintWizard.module.scss'

interface SummaryPanelProps {
  artwork: WizardArtwork
  catalog: Catalog
  config: WizardConfig
  quote: Quote | null
  quoteLoading: boolean
  canContinue: boolean
  /** Adds the configured item to the cart. Async to leave room for a
   *  server-side reservation step (limited editions) before the line
   *  is committed. Resolve only on a successful add. */
  onAddToCart: () => Promise<void>
  /** Returns the buyer to where they came from (reuses the wizard's
   *  CLOSE behavior) after a successful add. */
  onContinueShopping: () => void
  /** Limited editions only: "1/50" rendered on the preview. */
  editionLabel?: string
  /** Limited editions only: a friendly message when the reservation failed
   *  (sold out / only N left). Rendered above the CTA; not an error throw. */
  addError?: string | null
  /** True when the buyer arrived via the cart's "Edit item" link — the line
   *  is already in the cart, so the CTA reads "Update cart" not "Add to cart". */
  isEditing?: boolean
  /** True when the current configuration exactly matches a line already in the
   *  cart — adding would merge into a quantity bump, so we confirm first. */
  isDuplicate?: boolean
  /** True when the caller navigates away on a successful add (the limited path
   *  goes straight to the cart). Suppresses the "Continue shopping / Go to
   *  cart" pair, which would otherwise flash for a frame on the way out — and
   *  which a limited buyer should never be offered: walking away from a live
   *  hold is not an ordinary next step. */
  navigatesAfterAdd?: boolean
  /** True when a cart line already matches the CURRENT selection. Nothing is
   *  reserved by that — it just means the buyer has this exact print in their
   *  cart, so the action is to go and finish rather than add it twice. */
  alreadyInCart?: boolean
  /** Order-flow.md: the edition named over the title and in the Learn more row. */
  editionType?: 'open' | 'limited'
  /** Opens the Learn more window (the edition's terms of sale and shipping). */
  onLearnMore?: () => void
  /** A line under the button: the limited path's "not reserved until you pay". */
  caveat?: string
}

export const SummaryPanel = ({
  artwork,
  catalog,
  config,
  quote,
  quoteLoading,
  canContinue,
  onAddToCart,
  onContinueShopping,
  editionLabel,
  addError,
  isEditing = false,
  isDuplicate = false,
  navigatesAfterAdd = false,
  alreadyInCart = false,
  editionType = 'open',
  onLearnMore,
  caveat,
}: SummaryPanelProps) => {
  const ctaLabel = isEditing ? 'Update cart' : 'Add to cart'
  const ctaBusyLabel = isEditing ? 'Updating…' : 'Adding…'
  // Local add-to-cart state. Once an item has been added we swap the
  // single CTA for the "Continue shopping / Go to cart" pair.
  const [added, setAdded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmDupOpen, setConfirmDupOpen] = useState(false)

  // Arrive from "Edit item" and change nothing and the line still matches, so
  // the button is "Go to cart" — there is no update to make. Pick a different
  // variant and it stops matching, and "Update cart" returns.
  const alreadyHeld = alreadyInCart

  // Reset add-to-cart state when the buyer changes their configuration
  // or switches variant — the previously added item no longer reflects
  // the current selection, so the CTA must return to "Add to cart".
  useEffect(() => {
    setAdded(false)
    setAdding(false)
  }, [config, editionLabel])

  const performAdd = async () => {
    if (adding) return
    setAdding(true)
    try {
      await onAddToCart()
      if (!navigatesAfterAdd) setAdded(true)
    } catch {
      // The reservation failed (sold out / insufficient stock). The parent
      // surfaces the message via `addError`; keep the CTA on "Add to cart"
      // and don't flip to the added state.
    } finally {
      setAdding(false)
    }
  }

  const handleAddToCart = () => {
    // The exact same print is already in the cart → confirm before merging
    // into a quantity bump, so a buyer reaching for "another size" isn't
    // surprised when an identical config silently increments instead.
    if (isDuplicate) {
      setConfirmDupOpen(true)
      return
    }
    void performAdd()
  }

  return (
    <aside className={styles.summaryPanel}>
      <div className={styles.summaryHeader}>
        {/* Work first, artist under it — the same order the cart recap and the
            checkout line use, so the buyer sees one identity block all the way
            through. */}
        <span className={styles.summaryEdition}>
          {editionType === 'limited' ? 'Limited edition' : 'Open edition'}
        </span>
        <h2 className={styles.summaryTitle}>
          <em>{artwork.title}</em>
        </h2>
        <span className={styles.summaryArtist}>{artwork.artistName}</span>
      </div>

      {/* Never collapsed here. The measurement diagram used to sit in this
          panel and squeezed the rows behind a "Show all selected options"
          toggle; it now has the center column to itself, so the full
          configuration fits without hiding any of it behind a control. */}
      <div className={styles.summarySpecs}>
        <SpecList specs={summarizeConfig(catalog, config)} collapsible={false} />
      </div>

      {(() => {
        // Base price — the per-configuration figure (artwork + production, no
        // shipping, no VAT) so buyers can compare options. Shipping and tax are
        // folded in later at the cart/checkout. "Base" is the honest word for
        // it: "Item price" read like the amount that would be charged.
        const artworkLine = quote?.lines.find((l) => l.id === 'artwork')
        const placeholder = quoteLoading ? '…' : '—'
        return (
          <dl className={styles.priceList}>
            <div className={styles.priceRow}>
              <dt>Price</dt>
              <dd>{artworkLine ? formatEuro(artworkLine.amountCents) : placeholder}</dd>
            </div>
            {/* Says out loud what "base" leaves out, at the point of decision
                rather than a page later. Same sentence the cart uses. */}
          </dl>
        )
      })()}

      {/* Already holding this exact print: the action is to go and finish, not
          to reserve a second numbered copy. "Add to cart" here both misread the
          state and pointed at the one thing the Terms forbid — one edition per
          household. Not while EDITING, where the buyer came from the cart to
          change this very line and still needs "Update cart". */}
      {alreadyHeld ? (
        <Button
          variant="primary"
          size="bigSquared"
          fullWidth
          href="/cart"
          label="Go to cart"
          className={styles.ctaButton}
        />
      ) : added ? (
        <div className={styles.addedActions}>
          <Button
            variant="secondary"
            size="bigSquared"
            fullWidth
            onClick={onContinueShopping}
            label="Continue shopping"
          />
          <Button
            variant="primary"
            size="bigSquared"
            fullWidth
            href="/cart"
            label="Go to cart"
            className={styles.ctaButton}
          />
        </div>
      ) : (
        <>
          {addError && (
            <p className={styles.addError} role="alert">
              {addError}
            </p>
          )}
          <Button
            variant="primary"
            size="bigSquared"
            fullWidth
            onClick={handleAddToCart}
            disabled={!canContinue || adding}
            label={adding ? ctaBusyLabel : ctaLabel}
            className={styles.ctaButton}
          />
        </>
      )}

      {/* Says out loud what the price leaves out, at the point of decision (order-flow.md). */}
      <p className={styles.priceNote}>
        Shipping and taxes are calculated at checkout. Signed certificate of authenticity included.
      </p>
      {caveat && <p className={styles.priceNote}>{caveat}</p>}

      {onLearnMore && (
        <Button variant="bare" className={styles.learnMore} onClick={onLearnMore}>
          <Info size={20} weight="light" aria-hidden />
          <span className={styles.learnMoreText}>
            <span className={styles.learnMoreTitle}>
              {editionType === 'limited'
                ? 'What is a limited edition?'
                : 'What is an open edition?'}
            </span>
            <span className={styles.learnMoreSub}>Terms of sale and shipping</span>
          </span>
          <CaretRight size={16} weight="light" aria-hidden />
        </Button>
      )}

      {confirmDupOpen && (
        <ConfirmModal
          title="Already in your cart"
          message="You already have this exact print in your cart. Add it again and we’ll just increase that item’s quantity."
          confirmLabel="Add anyway"
          onConfirm={() => {
            setConfirmDupOpen(false)
            void performAdd()
          }}
          onCancel={() => setConfirmDupOpen(false)}
        />
      )}
    </aside>
  )
}
