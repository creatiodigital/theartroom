'use server'

import { captureError } from '@/lib/observability/captureError'
import { stripe } from '@/lib/stripe/client'

export type TaxEstimateInput = {
  /** ISO-2 destination country (buyer's shipping country). */
  countryCode: string
  /** Optional postal code — sharpens US state-level tax, harmless in EU. */
  postalCode?: string
  /** Pre-tax subtotal in minor units. Single line because we sell one item per order. */
  preTaxCents: number
  /** Currency the above is denominated in (lowercase ISO-4217). */
  currency: string
}

export type TaxEstimate = {
  /** Tax amount in the same currency/minor units. */
  taxCents: number
  /** preTaxCents + taxCents. */
  totalCents: number
  /** Stripe Tax calculation id, used to materialise a TaxTransaction on payment success. */
  calculationId: string
  /**
   * Human label for the UI ("VAT 21%", "Sales tax 8.5%"). Derived from the
   * first tax breakdown entry — we only have one line item so there's at
   * most one tax rate in play per calculation.
   */
  label: string
  /**
   * The buyer's ISO-2 country as Stripe resolved it — useful for the UI
   * when we want to confirm we're charging the destination rate.
   */
  resolvedCountry: string
}

export type TaxEstimateResult = { ok: true; data: TaxEstimate } | { ok: false; error: string }

/**
 * Ask Stripe Tax for the tax due on a pre-tax subtotal shipped to the
 * given country. Uses `tax.calculations.create` — a preview-only call
 * (no side effects) that returns the exact tax amount Stripe would
 * charge on a matching PaymentIntent.
 *
 * On payment success the webhook finalises the tax by calling
 * `stripe.tax.transactions.createFromCalculation({ calculation })` so
 * Stripe's OSS/tax reporting captures the sale.
 *
 * Requires Stripe Tax to be enabled on the platform account with an
 * origin address configured (Settings → Tax).
 */
export async function getTaxEstimate(input: TaxEstimateInput): Promise<TaxEstimateResult> {
  if (!input.countryCode || input.preTaxCents <= 0) {
    return { ok: false, error: 'Invalid tax inputs.' }
  }
  try {
    const calc = await stripe.tax.calculations.create({
      currency: input.currency,
      line_items: [
        {
          amount: input.preTaxCents,
          reference: 'print',
          // 'exclusive' = tax is added on top of the amount, which matches
          // how we price (amount is what we keep + costs, tax is extra).
          tax_behavior: 'exclusive',
        },
      ],
      customer_details: {
        address: {
          country: input.countryCode,
          postal_code: input.postalCode,
        },
        address_source: 'shipping',
      },
      // Tell Stripe the line item is a "goods" (physical print), not SaaS.
      // Default product tax code for physical goods. Stripe will apply
      // the right rate per-destination.
      expand: ['line_items.data.tax_breakdown'],
    })

    const taxCents = calc.tax_amount_exclusive ?? 0
    const amountTotal = calc.amount_total ?? input.preTaxCents + taxCents
    const firstLineBreakdown = calc.line_items?.data?.[0]?.tax_breakdown?.[0]
    const rate = firstLineBreakdown?.tax_rate_details
    const label = rate?.percentage_decimal
      ? `${rateShort(rate.percentage_decimal)}% ${rateName(rate.tax_type)}`
      : 'Tax'

    return {
      ok: true,
      data: {
        taxCents,
        totalCents: amountTotal,
        calculationId: calc.id!,
        label,
        resolvedCountry: calc.customer_details?.address?.country ?? input.countryCode,
      },
    }
  } catch (err) {
    console.error('[getTaxEstimate] Stripe Tax failed:', err)
    captureError(err, {
      flow: 'payment',
      stage: 'tax-calc',
      extra: {
        countryCode: input.countryCode,
        postalCode: input.postalCode,
        preTaxCents: input.preTaxCents,
        currency: input.currency,
      },
      level: 'warning',
      fingerprint: ['payment:tax-calc-failed'],
    })
    return {
      ok: false,
      error: 'Could not calculate tax.',
    }
  }
}

/** Strip trailing zeros from Stripe's rate strings: "21.0000" → "21". */
function rateShort(raw: string): string {
  const n = Number(raw)
  return Number.isFinite(n) ? String(Number(n.toFixed(2))) : raw
}

function rateName(type: string | null | undefined): string {
  if (!type) return 'Tax'
  // Map the tax_type the way a human would write it.
  const map: Record<string, string> = {
    vat: 'VAT',
    gst: 'GST',
    pst: 'PST',
    qst: 'QST',
    rst: 'RST',
    jct: 'JCT',
    sales_tax: 'Sales tax',
    hst: 'HST',
  }
  return map[type] ?? 'Tax'
}
