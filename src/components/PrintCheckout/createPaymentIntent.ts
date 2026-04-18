'use server'

import crypto from 'node:crypto'

import type { PrintConfig } from '@/components/PrintWizard/types'
import { GALLERY_MARKUP_RATE } from '@/components/PrintWizard/options'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

import { getProdigiQuote } from './getQuote'
import { getTaxEstimate } from './getTaxEstimate'

export type ShippingAddress = {
  fullName: string
  email: string
  phone: string
  countryCode: string
  address1: string
  address2: string
  city: string
  stateOrRegion: string
  postalCode: string
}

export type CreatePaymentIntentInput = {
  artworkSlug: string
  config: PrintConfig
  address: ShippingAddress
}

export type CreatePaymentIntentResult =
  | {
      ok: true
      clientSecret: string
      paymentIntentId: string
      totals: {
        itemCents: number
        shippingCents: number
        artistCents: number
        galleryCents: number
        customerVatCents: number
        totalCents: number
        currency: string
      }
    }
  | { ok: false; error: string }

/**
 * Server-authoritative payment setup. Re-fetches a Prodigi quote for the
 * user's config + country (so we don't trust the number the client saw),
 * stacks our artist + gallery cuts + EU VAT on top, then opens a Stripe
 * PaymentIntent for the final total.
 *
 * Metadata carries everything we need to fulfill the order after the
 * payment succeeds — when we wire Prodigi order creation in the next
 * phase, the webhook handler reads this back.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<CreatePaymentIntentResult> {
  const { artworkSlug, config, address } = input

  const artwork = await prisma.artwork.findUnique({
    where: { slug: artworkSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      userId: true,
      printEnabled: true,
      printPriceCents: true,
    },
  })
  if (!artwork) {
    return { ok: false, error: 'Artwork not found.' }
  }
  if (!artwork.printEnabled || !artwork.printPriceCents) {
    return { ok: false, error: 'This artwork is not currently available as a print.' }
  }

  const quote = await getProdigiQuote(config, address.countryCode)
  if (!quote.ok) {
    return {
      ok: false,
      error: `Couldn't price this configuration right now. (${quote.error})`,
    }
  }

  const artistCents = artwork.printPriceCents
  const galleryCents = Math.round(artistCents * GALLERY_MARKUP_RATE)
  const prodigiCents = quote.data.itemCents + quote.data.shippingCents
  const preTaxCents = artistCents + galleryCents + prodigiCents
  const currency = 'eur'

  // Stripe Tax is the source of truth for the rate + amount. It picks the
  // destination country's rate (21% Spain, 19% Germany, 20% France, …) and
  // handles OSS reporting downstream via the TaxTransaction we create in
  // the payment_intent.succeeded webhook.
  const taxRes = await getTaxEstimate({
    countryCode: address.countryCode,
    postalCode: address.postalCode,
    preTaxCents,
    currency,
  })
  if (!taxRes.ok) {
    return { ok: false, error: `Could not calculate tax: ${taxRes.error}` }
  }
  const customerVatCents = taxRes.data.taxCents
  const taxCalculationId = taxRes.data.calculationId
  const totalCents = taxRes.data.totalCents

  // Stable idempotency key so a double-click on "Continue to payment"
  // returns the same PaymentIntent instead of creating duplicates. Any
  // change to inputs (config, address, total) produces a new key.
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        artworkId: artwork.id,
        config,
        address,
        totalCents,
        currency,
      }),
    )
    .digest('hex')

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency,
        automatic_payment_methods: { enabled: true },
        // Manual capture — we authorize now, capture only when Prodigi
        // confirms the order has been allocated for production. See
        // memory/project_payment_auth_capture.md for the full flow.
        capture_method: 'manual',
        receipt_email: address.email || undefined,
        description: `Print: ${artwork.title ?? artwork.slug}`,
        shipping: {
          name: address.fullName,
          phone: address.phone || undefined,
          address: {
            line1: address.address1,
            line2: address.address2 || undefined,
            city: address.city,
            state: address.stateOrRegion || undefined,
            postal_code: address.postalCode,
            country: address.countryCode,
          },
        },
        metadata: {
          artworkSlug: artwork.slug ?? artworkSlug,
          artworkId: artwork.id,
          artistUserId: artwork.userId,
          paperId: config.paperId,
          formatId: config.formatId,
          sizeId: config.sizeId,
          frameColorId: config.frameColorId,
          mountId: config.mountId,
          orientation: config.orientation,
          countryCode: address.countryCode,
          customerEmail: address.email,
          prodigiItemCents: String(quote.data.itemCents),
          prodigiShippingCents: String(quote.data.shippingCents),
          artistCents: String(artistCents),
          galleryCents: String(galleryCents),
          customerVatCents: String(customerVatCents),
          // Links this payment to a Stripe Tax calculation; the webhook
          // materialises it into a TaxTransaction once payment succeeds
          // so the sale shows up in OSS reports.
          taxCalculationId,
        },
      },
      { idempotencyKey },
    )

    if (!pi.client_secret) {
      return { ok: false, error: 'Payment could not be initialized. Please try again.' }
    }

    return {
      ok: true,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      totals: {
        itemCents: quote.data.itemCents,
        shippingCents: quote.data.shippingCents,
        artistCents,
        galleryCents,
        customerVatCents,
        totalCents,
        currency,
      },
    }
  } catch (err) {
    console.error('[createPaymentIntent] Stripe failed:', err)
    return {
      ok: false,
      error: 'Payment could not be initialized. Please try again.',
    }
  }
}
