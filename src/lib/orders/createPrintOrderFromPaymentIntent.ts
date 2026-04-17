import prisma from '@/lib/prisma'
import { ProdigiError, createOrder, getProduct } from '@/lib/prodigi/client'
import { resolveSku } from '@/components/PrintWizard/options'
import type { PrintConfig } from '@/components/PrintWizard/types'

type StripePaymentIntent = {
  id: string
  metadata?: Record<string, string>
  shipping?: {
    name?: string | null
    phone?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    } | null
  } | null
  receipt_email?: string | null
}

/**
 * Called from the `payment_intent.succeeded` webhook. Creates (or finds)
 * the local PrintOrder row and submits the order to Prodigi if it hasn't
 * been submitted yet.
 *
 * Idempotency: the PrintOrder row is keyed on paymentIntentId. If a
 * Stripe webhook retries we'll find the existing row. Prodigi order
 * submission is gated on `prodigiOrderId == null` so we never
 * double-submit.
 */
export async function createPrintOrderFromPaymentIntent(
  pi: StripePaymentIntent,
): Promise<
  { ok: true; orderId: string; prodigiOrderId: string | null } | { ok: false; error: string }
> {
  const md = pi.metadata ?? {}
  const artworkId = md.artworkId
  const artistUserId = md.artistUserId
  const country = md.countryCode
  if (!artworkId || !artistUserId || !country) {
    return { ok: false, error: 'PaymentIntent missing required metadata.' }
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    select: { id: true, slug: true, title: true, imageUrl: true, userId: true },
  })
  if (!artwork) return { ok: false, error: `Artwork ${artworkId} not found.` }
  // Guard against cross-artist metadata tampering.
  if (artwork.userId !== artistUserId) {
    return { ok: false, error: 'Artwork/artist mismatch on PaymentIntent.' }
  }

  const config: PrintConfig = {
    paperId: md.paperId as PrintConfig['paperId'],
    formatId: md.formatId as PrintConfig['formatId'],
    sizeId: md.sizeId as PrintConfig['sizeId'],
    frameColorId: md.frameColorId as PrintConfig['frameColorId'],
    mountId: md.mountId as PrintConfig['mountId'],
    unit: 'cm',
  }

  const buyerName = pi.shipping?.name ?? ''
  const addr = pi.shipping?.address ?? {}

  const order = await prisma.printOrder.upsert({
    where: { paymentIntentId: pi.id },
    create: {
      paymentIntentId: pi.id,
      artworkId: artwork.id,
      artistUserId,
      buyerEmail: pi.receipt_email ?? md.customerEmail ?? '',
      buyerName,
      shippingAddress: {
        line1: addr.line1 ?? '',
        line2: addr.line2 ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
        postalCode: addr.postal_code ?? '',
        country: addr.country ?? country,
        phone: pi.shipping?.phone ?? '',
      },
      printConfig: config as unknown as object,
      country,
      totalCents:
        Number(md.prodigiItemCents ?? 0) +
        Number(md.prodigiShippingCents ?? 0) +
        Number(md.artistCents ?? 0) +
        Number(md.galleryCents ?? 0) +
        Number(md.customerVatCents ?? 0),
      artistCents: Number(md.artistCents ?? 0),
      galleryCents: Number(md.galleryCents ?? 0),
      prodigiItemCents: Number(md.prodigiItemCents ?? 0),
      prodigiShippingCents: Number(md.prodigiShippingCents ?? 0),
      customerVatCents: Number(md.customerVatCents ?? 0),
      currency: 'eur',
      paymentStatus: 'succeeded',
    },
    update: { paymentStatus: 'succeeded' },
  })

  if (order.prodigiOrderId) {
    return { ok: true, orderId: order.id, prodigiOrderId: order.prodigiOrderId }
  }

  if (!artwork.imageUrl) {
    return { ok: false, error: 'Artwork has no imageUrl; cannot submit to Prodigi.' }
  }

  const { sku, attributes } = resolveSku(config)

  try {
    const product = await getProduct(sku)
    const allAttrs: Record<string, string> = {}
    for (const [name, values] of Object.entries(product.product.attributes)) {
      allAttrs[name] = attributes[name] ?? values[0]
    }

    const prodigiRes = await createOrder({
      merchantReference: order.id,
      shippingMethod: 'Standard',
      idempotencyKey: order.id,
      recipient: {
        name: buyerName || 'Recipient',
        email: order.buyerEmail || undefined,
        phoneNumber: pi.shipping?.phone || undefined,
        address: {
          line1: addr.line1 ?? '',
          line2: addr.line2 ?? undefined,
          townOrCity: addr.city ?? '',
          stateOrCounty: addr.state ?? undefined,
          postalOrZipCode: addr.postal_code ?? '',
          countryCode: addr.country ?? country,
        },
      },
      items: [
        {
          sku,
          copies: 1,
          attributes: allAttrs,
          assets: Object.keys(product.product.printAreas).map((pa) => ({
            printArea: pa,
            url: artwork.imageUrl!,
          })),
        },
      ],
    })

    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        prodigiOrderId: prodigiRes.order.id,
        prodigiStage: prodigiRes.order.status.stage,
      },
    })

    return {
      ok: true,
      orderId: order.id,
      prodigiOrderId: prodigiRes.order.id,
    }
  } catch (err) {
    const detail =
      err instanceof ProdigiError
        ? JSON.stringify(err.body)
        : err instanceof Error
          ? err.message
          : String(err)
    console.error(
      `[createPrintOrderFromPaymentIntent] Prodigi createOrder failed for order ${order.id}:`,
      detail,
    )
    return { ok: false, error: `Prodigi submission failed: ${detail}` }
  }
}
