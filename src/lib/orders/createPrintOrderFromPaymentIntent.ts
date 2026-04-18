import prisma from '@/lib/prisma'
import { ProdigiError, createOrder, getProduct } from '@/lib/prodigi/client'
import { resolveSku } from '@/components/PrintWizard/options'
import type { PrintConfig } from '@/components/PrintWizard/types'
import { sendOrderPlacedEmail } from '@/lib/emails/orderPlaced'
import { logOrderEvent } from './logOrderEvent'

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
 * Called from the `payment_intent.amount_capturable_updated` webhook once
 * the buyer's card is authorized (funds held, not captured). Creates (or
 * finds) the local PrintOrder row and submits the order to Prodigi.
 *
 * The buyer's card is captured later, from the Prodigi callback, once
 * Prodigi has allocated the order for production. See
 * memory/project_payment_auth_capture.md for the full flow.
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
    select: {
      id: true,
      slug: true,
      title: true,
      imageUrl: true,
      originalImageUrl: true,
      originalWidth: true,
      originalHeight: true,
      userId: true,
      user: { select: { name: true, lastName: true } },
    },
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
    orientation: (md.orientation as PrintConfig['orientation']) ?? 'portrait',
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
      paymentStatus: 'authorized',
    },
    // Don't downgrade — if we're already 'succeeded' (captured) keep it.
    update: {},
  })

  // Buyer confirmation email — sent the first time we see this order.
  // The event log is the idempotency gate: if the webhook retries, we
  // find the prior email_sent event and skip.
  const alreadyEmailed = await prisma.printOrderEvent.findFirst({
    where: { orderId: order.id, kind: 'email_sent', message: 'order_placed' },
    select: { id: true },
  })
  if (!alreadyEmailed && order.buyerEmail) {
    const artistName = [artwork.user?.name, artwork.user?.lastName].filter(Boolean).join(' ').trim()
    const emailRes = await sendOrderPlacedEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      orderId: order.id,
      artworkTitle: artwork.title ?? '',
      artistName,
      totalCents: order.totalCents,
      currency: order.currency,
    })
    await logOrderEvent({
      orderId: order.id,
      kind: emailRes.ok ? 'email_sent' : 'email_failed',
      actor: 'system',
      message: 'order_placed',
      payload: emailRes.ok
        ? { to: order.buyerEmail, resendId: emailRes.id }
        : { to: order.buyerEmail, error: emailRes.error },
    })
  }

  if (order.prodigiOrderId) {
    return { ok: true, orderId: order.id, prodigiOrderId: order.prodigiOrderId }
  }

  const printImageUrl = artwork.originalImageUrl ?? artwork.imageUrl
  if (!printImageUrl) {
    return { ok: false, error: 'Artwork has no image; cannot submit to Prodigi.' }
  }

  const { sku, attributes } = resolveSku(config)

  // If the buyer's chosen orientation matches the image's natural orientation,
  // crop to fill the print area (gallery look). If they forced the opposite
  // orientation, fit with whitespace so the artwork isn't heavily cropped or
  // rotated by Prodigi's auto-rotation.
  const imgW = artwork.originalWidth ?? 0
  const imgH = artwork.originalHeight ?? 0
  const imageIsLandscape = imgW > 0 && imgH > 0 ? imgW >= imgH : true
  const chosenIsLandscape = config.orientation === 'landscape'
  const sizing = imageIsLandscape === chosenIsLandscape ? 'fillPrintArea' : 'fitPrintArea'

  try {
    const product = await getProduct(sku)
    const allAttrs: Record<string, string> = {}
    for (const [name, values] of Object.entries(product.product.attributes)) {
      allAttrs[name] = attributes[name] ?? values[0]
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
    const prodigiSecret = process.env.PRODIGI_WEBHOOK_SECRET ?? ''
    const callbackUrl = prodigiSecret
      ? `${siteUrl}/api/webhooks/prodigi?key=${encodeURIComponent(prodigiSecret)}`
      : undefined

    const prodigiRes = await createOrder({
      merchantReference: order.id,
      shippingMethod: 'Standard',
      idempotencyKey: order.id,
      callbackUrl,
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
          sizing,
          attributes: allAttrs,
          assets: Object.keys(product.product.printAreas).map((pa) => ({
            printArea: pa,
            url: printImageUrl,
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

    await logOrderEvent({
      orderId: order.id,
      kind: 'prodigi_submitted',
      actor: 'system',
      message: `Prodigi order created: ${prodigiRes.order.id} (${prodigiRes.outcome})`,
      payload: {
        prodigiOrderId: prodigiRes.order.id,
        outcome: prodigiRes.outcome,
        stage: prodigiRes.order.status.stage,
        issues: prodigiRes.order.status.issues,
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
    await logOrderEvent({
      orderId: order.id,
      kind: 'prodigi_submit_failed',
      actor: 'system',
      message: 'Prodigi createOrder threw',
      payload: {
        error: detail,
        status: err instanceof ProdigiError ? err.status : undefined,
        body: err instanceof ProdigiError ? err.body : undefined,
      },
    })
    return { ok: false, error: `Prodigi submission failed: ${detail}` }
  }
}
