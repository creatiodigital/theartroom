import prisma from '@/lib/prisma'
import { resolveSku } from '@/components/PrintWizard/options'
import type { PrintConfig } from '@/components/PrintWizard/types'
import { generateAndUploadCertificate } from '@/lib/certificates/generateAndUploadCertificate'
import { sendAdminOrderNotification } from '@/lib/emails/adminOrderNotification'
import { sendOrderPlacedEmail } from '@/lib/emails/orderPlaced'
import { captureError } from '@/lib/observability/captureError'
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
 * finds) the local PrintOrder row so the gallery admin can place the
 * order in the Prodigi dashboard by hand.
 *
 * MANUAL FULFILLMENT MODE (2026-04-24): auto-submit to Prodigi is disabled.
 * Buyer's card stays authorized; the admin captures manually from Stripe
 * when they place the Prodigi order. See
 * memory/project_manual_fulfillment_launch.md. To restore auto-submit,
 * pull the try/catch from commit f02fa81.
 *
 * Idempotency: the PrintOrder row is keyed on paymentIntentId. If a
 * Stripe webhook retries we'll find the existing row.
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
      printProvider: true,
      user: { select: { name: true, lastName: true, signatureUrl: true } },
    },
  })
  if (!artwork) {
    // Shouldn't happen in normal flow — either a DB inconsistency or
    // someone has tampered with the PI metadata. Either way we need eyes.
    captureError(new Error(`Artwork ${artworkId} not found during order creation`), {
      flow: 'order',
      stage: 'artwork-not-found',
      extra: { artworkId, artistUserId, paymentIntentId: pi.id },
      level: 'warning',
    })
    return { ok: false, error: `Artwork ${artworkId} not found.` }
  }
  // Guard against cross-artist metadata tampering.
  if (artwork.userId !== artistUserId) {
    captureError(new Error('Artwork/artist mismatch on PaymentIntent'), {
      flow: 'order',
      stage: 'artwork-artist-mismatch',
      extra: {
        artworkId,
        metadataArtistUserId: artistUserId,
        actualArtistUserId: artwork.userId,
        paymentIntentId: pi.id,
      },
      level: 'error',
      fingerprint: ['order:artwork-artist-mismatch'],
    })
    return { ok: false, error: 'Artwork/artist mismatch on PaymentIntent.' }
  }

  const config: PrintConfig = {
    paperId: md.paperId as PrintConfig['paperId'],
    formatId: md.formatId as PrintConfig['formatId'],
    sizeId: md.sizeId as PrintConfig['sizeId'],
    frameColorId: md.frameColorId as PrintConfig['frameColorId'],
    mountId: md.mountId as PrintConfig['mountId'],
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
      // Snapshot the artwork's provider at order time. If the artist
      // later switches their artwork to the other service, this order
      // remains pinned to whichever provider actually handled it.
      printProvider: artwork.printProvider,
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
      shippingCountryCode: addr.country ?? country,
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
    if (!emailRes.ok) {
      captureError(new Error(`Order-placed email failed: ${emailRes.error}`), {
        flow: 'email',
        stage: 'order-placed-send',
        extra: { orderId: order.id, to: order.buyerEmail, error: emailRes.error },
        level: 'warning',
        fingerprint: ['email:order-placed-failed'],
      })
    }
  }

  if (order.prodigiOrderId) {
    return { ok: true, orderId: order.id, prodigiOrderId: order.prodigiOrderId }
  }

  const printImageUrl = artwork.originalImageUrl ?? artwork.imageUrl
  if (!printImageUrl) {
    return { ok: false, error: 'Artwork has no image; cannot submit to Prodigi.' }
  }

  // Generate the certificate of authenticity PDF, upload to R2, and
  // include the public URL in the Prodigi order as a `branding.flyer`
  // asset (A5 insert shipped with the print). Idempotent via the event
  // log — if the webhook retries after a successful cert upload we reuse
  // the stored URL instead of re-rendering.
  let certificateUrl = order.certificateUrl
  if (!certificateUrl) {
    const artistName = [artwork.user?.name, artwork.user?.lastName].filter(Boolean).join(' ').trim()
    const certRes = await generateAndUploadCertificate({
      orderId: order.id,
      artworkTitle: artwork.title ?? '',
      artistName,
      signatureImageUrl: artwork.user?.signatureUrl ?? null,
      purchaseDate: order.createdAt,
    })
    if (certRes.ok) {
      certificateUrl = certRes.url
      await prisma.printOrder.update({
        where: { id: order.id },
        data: { certificateUrl: certRes.url },
      })
      await logOrderEvent({
        orderId: order.id,
        kind: 'note',
        actor: 'system',
        message: 'Certificate of authenticity generated',
        payload: { url: certRes.url },
      })
    } else {
      // Non-fatal: log and continue without the certificate. We'd rather
      // submit the order to Prodigi and ship the print than block on a
      // cert generation glitch.
      await logOrderEvent({
        orderId: order.id,
        kind: 'note',
        actor: 'system',
        message: 'Certificate generation failed (order continues without insert)',
        payload: { error: certRes.error },
      })
      captureError(new Error(`Certificate generation failed: ${certRes.error}`), {
        flow: 'cert',
        stage: 'generate-and-upload',
        extra: { orderId: order.id, error: certRes.error },
        level: 'warning',
        fingerprint: ['cert:generate-failed'],
      })
    }
  }

  const { sku, attributes } = resolveSku(config)

  // Admin order-notification email — idempotent via event log, same
  // pattern as the buyer email. Tells the gallery admin a new order is
  // ready to be placed by hand in the Prodigi dashboard; surfaces every
  // field needed to recreate the exact order.
  const alreadyNotifiedAdmin = await prisma.printOrderEvent.findFirst({
    where: { orderId: order.id, kind: 'email_sent', message: 'admin_order_notification' },
    select: { id: true },
  })
  if (!alreadyNotifiedAdmin) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
    const artistName = [artwork.user?.name, artwork.user?.lastName].filter(Boolean).join(' ').trim()
    const adminRes = await sendAdminOrderNotification({
      orderId: order.id,
      artworkTitle: artwork.title ?? '',
      artistName,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      shippingAddress: {
        line1: addr.line1 ?? '',
        line2: addr.line2 ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
        postalCode: addr.postal_code ?? '',
        country: addr.country ?? country,
        phone: pi.shipping?.phone ?? '',
      },
      totalCents: order.totalCents,
      currency: order.currency,
      sku,
      skuAttributes: attributes,
      assetUrl: printImageUrl,
      certificateUrl,
      adminOrderUrl: `${siteUrl}/admin/orders/${order.id}`,
    })
    await logOrderEvent({
      orderId: order.id,
      kind: adminRes.ok ? 'email_sent' : 'email_failed',
      actor: 'system',
      message: 'admin_order_notification',
      payload: adminRes.ok ? { resendId: adminRes.id } : { error: adminRes.error },
    })
    if (!adminRes.ok) {
      captureError(new Error(`Admin order-notification email failed: ${adminRes.error}`), {
        flow: 'email',
        stage: 'admin-order-notification-send',
        extra: { orderId: order.id, error: adminRes.error },
        level: 'warning',
        fingerprint: ['email:admin-order-notification-failed'],
      })
    }
  }

  // MANUAL FULFILLMENT MODE (2026-04-24): auto-submit to Prodigi is disabled.
  // Orders are placed by hand by the gallery admin via the Prodigi dashboard
  // using the data surfaced in /admin/orders. See
  // memory/project_manual_fulfillment_launch.md. To restore auto-submit,
  // pull the try/catch block from commit f02fa81.
  await logOrderEvent({
    orderId: order.id,
    kind: 'note',
    actor: 'system',
    message: 'Prodigi auto-submit skipped (manual fulfillment mode)',
    payload: { sku, attributes, assetUrl: printImageUrl, certificateUrl },
  })
  return { ok: true, orderId: order.id, prodigiOrderId: null }
}
