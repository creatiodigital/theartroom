'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { CartIcon } from '@/components/cart/CartIcon'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { clearPrintSession } from '@/components/checkout/clearPrintSession'
import { consumePrintReturnUrl } from '@/components/checkout/printReturnUrl'
import Logo from '@/icons/logo.svg'

import { buildCartItem } from '@/lib/cart/buildCartItem'
import { useCart } from '@/lib/cart/useCart'
import { type Catalog, type Quote, summarizeConfig } from '@/lib/print-providers'
import { getProviderQuote } from '@/lib/print-providers/quote'
import { variantToWizardConfig } from '@/lib/editions/variantToWizardConfig'
import {
  cartedVariantIds,
  resolveSelectedVariant,
  selectableVariants,
} from '@/lib/editions/variantSelection'

import { SchemaStage } from './SchemaStage'
import { SummaryPanel } from './SummaryPanel'
import { LearnMoreSheet } from './LearnMoreSheet'
import { VariantPicker, type VariantPickerItem } from './VariantPicker'
import type { WizardArtwork } from './index'

import styles from './PrintWizard.module.scss'

type Props = {
  artwork: WizardArtwork
  catalog: Catalog
}

function readCountryFromStash(slug: string): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = sessionStorage.getItem(`print-quote:${slug}`)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { country?: unknown }
    return typeof parsed.country === 'string' ? parsed.country : ''
  } catch {
    return ''
  }
}

/**
 * The limited-edition wizard: the buyer simply picks one of the artwork's
 * pre-defined variants — no size/paper/framing config. A selected variant
 * is translated into a canonical `WizardConfig` (`variantToWizardConfig`)
 * so the preview, summary, pricing and checkout handoff all reuse the
 * existing machinery unchanged. The chosen `variantId` is forwarded to
 * checkout so the server can reserve an edition number.
 */
export const LimitedWizard = ({ artwork, catalog }: Props) => {
  const router = useRouter()
  // NOTE: the cart shows no "Edit item" for a limited line and this wizard
  // reads no `editLineId` / `variant` param. Nothing here edits a line — see
  // the "marked, not locked" comment below.

  const { addItem, items } = useCart()

  // Every published variant is SHOWN, including sold-out ones — a buyer who saw
  // a size last week should learn it sold out, not find it quietly missing.
  const allVariants = useMemo(() => artwork.variants ?? [], [artwork.variants])
  // …but only the ones with stock can be SELECTED. This drives the selection
  // fallback and the whole-edition-sold-out panel; the picker renders from
  // `allVariants` and disables the rest.
  const available = useMemo(() => selectableVariants(allVariants), [allVariants])

  // A variant already in the cart is MARKED, not locked.
  //
  // Selecting is how an edition gets drawn in the measurement diagram, and a
  // buyer coming back for a last look at what they bought must not lose that as
  // a side effect of buying it. What a carted variant loses is only the add —
  // the cart offers no edit for a limited line and no second copy of one, the
  // variant being the object rather than a configuration of it.
  const cartedIds = useMemo(() => cartedVariantIds(items, artwork.id), [items, artwork.id])

  // One edition at a time, and always one: the schema and the spec list both
  // describe exactly one print, and the panel has nothing to say
  // without it. `resolveSelectedVariant` supplies the opening default, so this
  // starts empty and is filled by the buyer's first click. Picking another
  // switches; there is no unselecting.
  const [selectedId, setSelectedId] = useState('')
  const [country] = useState<string>(() => readCountryFromStash(artwork.slug))

  // Edition-details modal — opened ONLY when the buyer clicks "See Details" on
  // the persistent edition badge. No auto-show: the badge keeps the edition
  // type visible at all times, without interrupting the buyer.
  const [introOpen, setIntroOpen] = useState(false)
  const dismissIntro = () => setIntroOpen(false)

  // Re-resolved every render: it supplies the opening selection, and moves off
  // an edition that sells out under a selection left sitting there before it
  // can reach the preview or the add.
  const selected = useMemo(
    () => resolveSelectedVariant(selectedId, available),
    [selectedId, available],
  )
  // Already bought: the card stays selectable so it can be looked at again, but
  // the panel offers "Go to cart" in place of an add.
  const selectedInCart = !!selected && cartedIds.has(selected.id)
  // For the details modal: fall back to any variant (incl. sold-out) so the
  // edition-size text still renders when nothing is selected.
  const detailVariant = selected ?? artwork.variants?.[0] ?? null

  const config = useMemo(() => (selected ? variantToWizardConfig(selected) : null), [selected])

  // The mark stays in the diagram — it is part of what the buyer is buying, and
  // showing where it sits on the sheet matters. It is ILLUSTRATIVE: nothing is
  // reserved before payment, so the real number is unknown here. The terms say
  // so ("the number shown in the preview is for reference only"), which is what
  // stops "1/100" reading as a promise of the first copy.
  const editionLabel = selected ? `1/${selected.editionSize}` : undefined

  const quote: Quote | null = useMemo(
    () =>
      config
        ? getProviderQuote(catalog.providerId, {
            config,
            country,
            // Limited editions price per variant; fall back to the artwork
            // price only if a variant somehow lacks its own.
            artistPriceCents: selected?.priceCents ?? artwork.printPriceCents,
          })
        : null,
    [config, country, catalog.providerId, selected?.priceCents, artwork.printPriceCents],
  )

  // One quote per variant, keyed by id. The picker needs a price on every card
  // and an add commits several lines at once, so both read from here rather
  // than re-quoting per render or per click.
  const quotesByVariantId = useMemo(() => {
    const quotes = new Map<string, Quote>()
    for (const v of allVariants) {
      quotes.set(
        v.id,
        getProviderQuote(catalog.providerId, {
          config: variantToWizardConfig(v),
          country,
          artistPriceCents: v.priceCents ?? artwork.printPriceCents,
        }),
      )
    }
    return quotes
  }, [allVariants, country, catalog.providerId, artwork.printPriceCents])

  const pickerItems: VariantPickerItem[] = useMemo(
    () =>
      allVariants.map((v) => ({
        ...v,
        priceCents: quotesByVariantId.get(v.id)?.subtotalCents ?? 0,
      })),
    [allVariants, quotesByVariantId],
  )

  const [addError, setAddError] = useState<string | null>(null)

  // Clear any stale add error when the selection changes — the previous
  // sold-out message no longer applies to what is chosen now.
  useEffect(() => {
    setAddError(null)
  }, [selectedId])

  const close = () => {
    clearPrintSession(artwork.slug)
    router.push(consumePrintReturnUrl(artwork.slug) ?? '/prints')
  }

  const handleAddToCart = async () => {
    if (!selected || !config || !quote || selectedInCart) return

    setAddError(null)

    // Always an ADD, never a replace — nothing here edits an existing line.
    // `addItem` commits the line locally; stock is settled once, atomically,
    // when payment starts. Re-throw on failure so the panel does not flip to
    // its "added" state.
    try {
      await addItem({
        ...buildCartItem({
          artwork: {
            id: artwork.id,
            slug: artwork.slug,
            title: artwork.title,
            artistName: artwork.artistName,
            thumbnailUrl: artwork.imageUrl,
          },
          providerId: catalog.providerId,
          editionType: 'limited',
          variantId: selected.id,
          editionName: selected.name,
          config,
          quote,
          artistCents: selected.priceCents ?? artwork.printPriceCents,
          specsSummary: summarizeConfig(catalog, config),
        }),
        quantity: 1,
      })
      // Straight to the cart. A limited edition is one numbered copy of one
      // work — nobody arrives here to browse on, and offering "Continue
      // shopping" beside "Go to cart" made walking away look like an ordinary
      // next step. The cart is where the price and checkout live, so it IS the
      // next page.
      router.push('/cart')
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      setAddError(
        reason === 'SOLD_OUT'
          ? 'This edition just sold out.'
          : reason.startsWith('ONLY ')
            ? `Sorry, only ${reason.slice('ONLY '.length).replace(' LEFT', '')} left in this edition.`
            : 'Could not add to cart. Please try again.',
      )
      throw error
    }
  }

  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <Link href="/" aria-label="The Art Room" className={styles.logoLink}>
          <Logo className={styles.logo} aria-hidden />
        </Link>
        {/* order-flow.md: "Order a print · Title, Artist", the title in serif italics. */}
        <p className={styles.headerTitle}>
          Order a print · <em>{artwork.title}</em>, {artwork.artistName}
        </p>
        <div className={styles.headerActions}>
          <CartIcon />
          <Button
            variant="ghost"
            onClick={close}
            iconRight={<Icon name="close" size={16} />}
            className={styles.closeButton}
            aria-label="Close wizard"
          />
        </div>
      </header>

      <main className={styles.body}>
        {/* The caveat rides on the badge, before anything is chosen — there is
            no hold and no clock, so the one thing the buyer must know up front
            is that taking their time carries a risk. */}
        {available.length > 0 ? (
          <>
            <VariantPicker
              variants={pickerItems}
              selectedVariantId={selected?.id ?? ''}
              onSelect={setSelectedId}
              cartedVariantIds={cartedIds}
            />
            {/* The diagram is the reason to select at all. Nothing chosen
                yet, nothing to measure. */}
            {selected && config && (
              <SchemaStage
                catalog={catalog}
                config={config}
                imageUrl={artwork.imageUrl}
                editionLabel={editionLabel}
              />
            )}
            {selected && config && (
              <SummaryPanel
                artwork={artwork}
                catalog={catalog}
                config={config}
                quote={quote}
                quoteLoading={false}
                canContinue
                onAddToCart={handleAddToCart}
                onContinueShopping={close}
                editionLabel={editionLabel}
                navigatesAfterAdd
                alreadyInCart={selectedInCart}
                addError={addError}
                isDuplicate={selectedInCart}
                editionType="limited"
                onLearnMore={() => setIntroOpen(true)}
                caveat="Not reserved until you pay: another collector may take it first."
              />
            )}
          </>
        ) : (
          <div className={styles.soldOutPanel}>
            <p>This limited edition is sold out.</p>
          </div>
        )}
      </main>

      {introOpen && detailVariant && (
        <Modal
          onClose={dismissIntro}
          titleId="print-intro-title"
          maxWidth="640px"
          showClose
          tone="public"
        >
          {/* order-flow.md "Learn more window": the same points as before, dashes removed. */}
          <LearnMoreSheet
            editionType="limited"
            title={artwork.title}
            artistName={artwork.artistName}
            terms={[
              'Individually numbered: each print carries its own number in the margin below the image.',
              'Comes with a Certificate of Authenticity (COA), hand-signed by the artist: the signature is on the certificate, not the print.',
              'Sold unframed, on premium archival paper: frame it your way.',
              'Price might rise as the edition sells.',
              'Your edition number is allocated at the point of sale: the number shown in the preview is for reference only.',
              'Final VAT is calculated when you confirm your delivery address at checkout.',
              'Sales are strictly limited to one edition per household.',
              'We reserve the right to cancel or refund an order if needed.',
            ]}
            shipping={[
              'All editions are packaged to the highest standards, managed at our warehouse using archival materials.',
              'Shipping is calculated at checkout, based on your delivery address.',
              'Most editions are dispatched within about a week of purchase.',
              'Sent with tracked delivery: we’ll email you the tracking when it’s on its way.',
              'Delivery is typically 1–2 weeks.',
              'Orders may be subject to customs and local import duties.',
            ]}
          />
        </Modal>
      )}
    </div>
  )
}
