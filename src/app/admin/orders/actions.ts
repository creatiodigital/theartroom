'use server'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { sendAdminOrderCancelledAlert } from '@/lib/emails/adminOrderCancelled'
import { sendArtistPayoutEmail } from '@/lib/emails/artistPayout'
import { sendOrderCancelledEmail } from '@/lib/emails/orderCancelled'
import { sendOrderInProductionEmail } from '@/lib/emails/orderInProduction'
import { sendOrderShippedEmail } from '@/lib/emails/orderShipped'
import { sendRefundIssuedEmail } from '@/lib/emails/refundIssued'
import { captureError } from '@/lib/observability/captureError'
import { logOrderEvent } from '@/lib/orders/logOrderEvent'
import { PAYOUT_HOLD_DAYS, payoutEligibleAt } from '@/lib/orders/payoutPolicy'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export type AdminOrderRow = {
  id: string
  paymentIntentId: string
  createdAt: string
  artwork: { id: string; slug: string | null; title: string | null }
  artist: {
    id: string
    name: string
    stripeAccountId: string | null
    stripeOnboardingComplete: boolean
  }
  buyerEmail: string
  buyerName: string
  country: string
  totalCents: number
  artistCents: number
  currency: string
  paymentStatus: string
  prodigiOrderId: string | null
  prodigiStage: string | null
  trackingUrl: string | null
  shippedAt: string | null
  transferId: string | null
  transferStatus: string | null
  paidOutAt: string | null
  latestEvent: { kind: string; message: string | null; at: string } | null
  payoutEligibleAt: string | null
}

async function requireAdminSession() {
  const session = await auth()
  if (!session?.user?.id) return { ok: false as const, error: 'Not signed in.' }
  if (!isAdminOrAbove(session.user.userType)) {
    return { ok: false as const, error: 'Admin access required.' }
  }
  return { ok: true as const, session }
}

export async function listOrders(): Promise<
  { ok: true; orders: AdminOrderRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const rows = await prisma.printOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      artwork: { select: { id: true, slug: true, title: true } },
      artistUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
          stripeAccountId: true,
          stripeOnboardingComplete: true,
        },
      },
      events: {
        orderBy: { at: 'desc' },
        take: 1,
        select: { kind: true, message: true, at: true },
      },
    },
  })

  const orders: AdminOrderRow[] = rows.map((r) => ({
    id: r.id,
    paymentIntentId: r.paymentIntentId,
    createdAt: r.createdAt.toISOString(),
    artwork: {
      id: r.artwork.id,
      slug: r.artwork.slug,
      title: r.artwork.title,
    },
    artist: {
      id: r.artistUser.id,
      name: `${r.artistUser.name} ${r.artistUser.lastName}`.trim(),
      stripeAccountId: r.artistUser.stripeAccountId,
      stripeOnboardingComplete: r.artistUser.stripeOnboardingComplete,
    },
    buyerEmail: r.buyerEmail,
    buyerName: r.buyerName,
    country: r.country,
    totalCents: r.totalCents,
    artistCents: r.artistCents,
    currency: r.currency,
    paymentStatus: r.paymentStatus,
    prodigiOrderId: r.prodigiOrderId,
    prodigiStage: r.prodigiStage,
    trackingUrl: r.trackingUrl,
    shippedAt: r.shippedAt?.toISOString() ?? null,
    transferId: r.transferId,
    transferStatus: r.transferStatus,
    paidOutAt: r.paidOutAt?.toISOString() ?? null,
    latestEvent: r.events[0]
      ? { kind: r.events[0].kind, message: r.events[0].message, at: r.events[0].at.toISOString() }
      : null,
    payoutEligibleAt: payoutEligibleAt(r.shippedAt)?.toISOString() ?? null,
  }))

  return { ok: true, orders }
}

export type AdminOrderEvent = {
  id: string
  at: string
  kind: string
  actor: string
  message: string | null
  payload: unknown
}

export type AdminOrderDetail = AdminOrderRow & {
  shippingAddress: unknown
  printConfig: unknown
  prodigiItemCents: number
  prodigiShippingCents: number
  galleryCents: number
  customerVatCents: number
  /** R2 URL of the print-master image (original) the admin pastes into Prodigi. */
  assetUrl: string | null
  /** Web-sized thumbnail for visual ID at the top of the detail page. */
  thumbnailUrl: string | null
  certificateUrl: string | null
  events: AdminOrderEvent[]
}

export type AdminPayoutRow = {
  orderId: string
  paidOutAt: string
  artistName: string
  artistEmail: string | null
  artworkTitle: string
  artworkSlug: string | null
  amountCents: number
  currency: string
  transferId: string
}

/**
 * Returns every released artist payout, newest first. Used by the
 * /admin/payouts page for tax/accounting records. Only includes orders
 * where `transferId` is non-null (i.e. money has actually moved).
 */
export async function listArtistPayouts(): Promise<
  { ok: true; payouts: AdminPayoutRow[] } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const rows = await prisma.printOrder.findMany({
    where: { transferId: { not: null } },
    orderBy: { paidOutAt: 'desc' },
    take: 500,
    include: {
      artwork: { select: { title: true, slug: true } },
      artistUser: { select: { name: true, lastName: true, email: true } },
    },
  })

  const payouts: AdminPayoutRow[] = rows.map((r) => ({
    orderId: r.id,
    paidOutAt: (r.paidOutAt ?? r.updatedAt).toISOString(),
    artistName: `${r.artistUser.name} ${r.artistUser.lastName}`.trim(),
    artistEmail: r.artistUser.email ?? null,
    artworkTitle: r.artwork.title ?? r.artwork.slug ?? '(untitled)',
    artworkSlug: r.artwork.slug,
    amountCents: r.artistCents,
    currency: r.currency,
    transferId: r.transferId!,
  }))

  return { ok: true, payouts }
}

export async function getOrderDetail(
  orderId: string,
): Promise<{ ok: true; order: AdminOrderDetail } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const r = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artwork: {
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          originalImageUrl: true,
        },
      },
      artistUser: {
        select: {
          id: true,
          name: true,
          lastName: true,
          stripeAccountId: true,
          stripeOnboardingComplete: true,
        },
      },
      events: { orderBy: { at: 'desc' } },
    },
  })
  if (!r) return { ok: false, error: 'Order not found.' }

  const order: AdminOrderDetail = {
    id: r.id,
    paymentIntentId: r.paymentIntentId,
    createdAt: r.createdAt.toISOString(),
    artwork: { id: r.artwork.id, slug: r.artwork.slug, title: r.artwork.title },
    artist: {
      id: r.artistUser.id,
      name: `${r.artistUser.name} ${r.artistUser.lastName}`.trim(),
      stripeAccountId: r.artistUser.stripeAccountId,
      stripeOnboardingComplete: r.artistUser.stripeOnboardingComplete,
    },
    buyerEmail: r.buyerEmail,
    buyerName: r.buyerName,
    country: r.country,
    totalCents: r.totalCents,
    artistCents: r.artistCents,
    currency: r.currency,
    paymentStatus: r.paymentStatus,
    prodigiOrderId: r.prodigiOrderId,
    prodigiStage: r.prodigiStage,
    trackingUrl: r.trackingUrl,
    shippedAt: r.shippedAt?.toISOString() ?? null,
    transferId: r.transferId,
    transferStatus: r.transferStatus,
    paidOutAt: r.paidOutAt?.toISOString() ?? null,
    latestEvent: r.events[0]
      ? { kind: r.events[0].kind, message: r.events[0].message, at: r.events[0].at.toISOString() }
      : null,
    payoutEligibleAt: payoutEligibleAt(r.shippedAt)?.toISOString() ?? null,
    shippingAddress: r.shippingAddress,
    printConfig: r.printConfig,
    prodigiItemCents: r.prodigiItemCents,
    prodigiShippingCents: r.prodigiShippingCents,
    galleryCents: r.galleryCents,
    customerVatCents: r.customerVatCents,
    assetUrl: r.artwork.originalImageUrl ?? r.artwork.imageUrl ?? null,
    thumbnailUrl: r.artwork.imageUrl ?? r.artwork.originalImageUrl ?? null,
    certificateUrl: r.certificateUrl,
    events: r.events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      kind: e.kind,
      actor: e.actor,
      message: e.message,
      payload: e.payload,
    })),
  }

  return { ok: true, order }
}

/**
 * Release the artist's cut for a shipped order. Preconditions:
 *   - payment succeeded (status = 'succeeded')
 *   - Prodigi says Complete (shipped/delivered)
 *   - artist has a Connect account with onboarding complete
 *   - transfer hasn't already been sent
 *
 * Creates a Stripe Transfer from our balance to the artist's connected
 * account, stamping transferId + paidOutAt on the PrintOrder.
 */
export async function releasePayout(
  orderId: string,
): Promise<{ ok: true; transferId: string } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artistUser: {
        select: { stripeAccountId: true, stripeOnboardingComplete: true, name: true, email: true },
      },
      artwork: { select: { title: true, slug: true } },
    },
  })
  if (!order) return { ok: false, error: 'Order not found.' }

  if (order.paymentStatus !== 'succeeded') {
    return { ok: false, error: `Payment not succeeded (status: ${order.paymentStatus}).` }
  }
  if (order.prodigiStage !== 'Complete') {
    return {
      ok: false,
      error: `Prodigi stage is "${order.prodigiStage ?? 'pending'}"; wait until Complete before releasing.`,
    }
  }
  const eligible = payoutEligibleAt(order.shippedAt)
  if (!eligible || eligible.getTime() > Date.now()) {
    const when = eligible ? eligible.toLocaleDateString() : 'once the order has shipped'
    return {
      ok: false,
      error: `Payout not yet eligible — waiting ${PAYOUT_HOLD_DAYS} days after shipment. Available ${when}.`,
    }
  }
  if (order.transferId) {
    return { ok: false, error: `Payout already released (${order.transferId}).` }
  }
  const artistAccountId = order.artistUser.stripeAccountId
  if (!artistAccountId || !order.artistUser.stripeOnboardingComplete) {
    return { ok: false, error: 'Artist has not completed Stripe Connect onboarding.' }
  }
  if (order.artistCents <= 0) {
    return { ok: false, error: 'Artist amount is zero.' }
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: order.artistCents,
        currency: order.currency,
        destination: artistAccountId,
        transfer_group: order.paymentIntentId,
        description: `Artist payout for order ${order.id}`,
        metadata: { orderId: order.id, paymentIntentId: order.paymentIntentId },
      },
      // Same idempotency key across retries of the same order — Stripe
      // will return the original transfer on retry.
      { idempotencyKey: `payout:${order.id}` },
    )

    await prisma.printOrder.update({
      where: { id: order.id },
      data: {
        transferId: transfer.id,
        transferStatus: 'paid',
        paidOutAt: new Date(),
      },
    })

    const session = guard.session
    await logOrderEvent({
      orderId: order.id,
      kind: 'admin_action',
      actor: `admin:${session.user.id}`,
      message: 'Payout released',
      payload: { transferId: transfer.id, amountCents: order.artistCents },
    })

    // Artist notification — the *only* email the artist gets about this
    // sale. Send after the transfer has succeeded so we never promise
    // payout money that didn't actually move.
    if (order.artistUser.email) {
      const emailRes = await sendArtistPayoutEmail({
        to: order.artistUser.email,
        artistFirstName: order.artistUser.name ?? '',
        artworkTitle: order.artwork.title ?? order.artwork.slug ?? '(untitled)',
        amountCents: order.artistCents,
        currency: order.currency,
        transferId: transfer.id,
      })
      await logOrderEvent({
        orderId: order.id,
        kind: emailRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'artist_payout',
        payload: emailRes.ok
          ? { to: order.artistUser.email, resendId: emailRes.id }
          : { to: order.artistUser.email, error: emailRes.error },
      })
    }

    return { ok: true, transferId: transfer.id }
  } catch (err) {
    console.error(`[releasePayout] order=${order.id} failed:`, err)
    captureError(err, {
      flow: 'admin',
      stage: 'release-payout',
      extra: {
        orderId: order.id,
        artistUserId: order.artistUserId,
        artistAccountId,
        amountCents: order.artistCents,
      },
      level: 'error',
      fingerprint: ['admin:release-payout-failed'],
    })
    return { ok: false, error: 'Stripe transfer failed. Check server logs.' }
  }
}

/**
 * Full refund of a buyer's order. Handles both pre-capture (authorized,
 * no money moved) and post-capture (succeeded, money in our balance)
 * states. Does NOT touch Prodigi — that vendor side is handled manually
 * by the admin.
 *
 * If the artist payout has already been released, we still allow the
 * refund but surface a warning in the event log so you know to chase
 * the artist's share separately.
 */
export async function refundOrder(
  orderId: string,
  opts: { reason: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard
  const adminId = guard.session.user.id

  const reason = (opts.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'A reason is required for the audit log.' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.paymentStatus === 'refunded') {
    return { ok: false, error: 'Order is already refunded.' }
  }
  if (order.paymentStatus === 'canceled') {
    return { ok: false, error: 'Order was already canceled (no charge to refund).' }
  }
  if (order.paymentStatus === 'failed') {
    return { ok: false, error: 'Payment never succeeded — nothing to refund.' }
  }

  try {
    if (order.paymentStatus === 'authorized') {
      // Auth only — no money has moved. Canceling the PaymentIntent
      // releases the hold; the buyer is never charged.
      await stripe.paymentIntents.cancel(order.paymentIntentId, {
        cancellation_reason: 'requested_by_customer',
      })
    } else {
      // Captured — pull money back from our Stripe balance to the buyer's card.
      await stripe.refunds.create(
        {
          payment_intent: order.paymentIntentId,
          reason: 'requested_by_customer',
          metadata: { orderId: order.id, adminReason: reason.slice(0, 500) },
        },
        { idempotencyKey: `refund:${order.id}` },
      )
    }

    await prisma.printOrder.update({
      where: { id: order.id },
      data: { paymentStatus: 'refunded' },
    })

    await logOrderEvent({
      orderId: order.id,
      kind: 'admin_action',
      actor: `admin:${adminId}`,
      message: 'Refund issued',
      payload: {
        reason,
        amountCents: order.totalCents,
        payoutAlreadyReleased: !!order.transferId,
      },
    })

    if (order.buyerEmail) {
      const emailRes = await sendRefundIssuedEmail({
        to: order.buyerEmail,
        buyerName: order.buyerName,
        orderId: order.id,
        amountCents: order.totalCents,
        currency: order.currency,
      })
      await logOrderEvent({
        orderId: order.id,
        kind: emailRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'refund_issued',
        payload: emailRes.ok
          ? { to: order.buyerEmail, resendId: emailRes.id }
          : { to: order.buyerEmail, error: emailRes.error },
      })
    }

    return { ok: true }
  } catch (err) {
    console.error(`[refundOrder] order=${orderId} failed:`, err)
    captureError(err, {
      flow: 'admin',
      stage: 'refund-order',
      extra: {
        orderId,
        paymentIntentId: order.paymentIntentId,
        paymentStatus: order.paymentStatus,
        amountCents: order.totalCents,
        reason,
      },
      level: 'error',
      fingerprint: ['admin:refund-failed'],
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Refund failed. Check server logs.',
    }
  }
}

/**
 * Dev-only: create a fake end-to-end test order that lands in Prodigi
 * sandbox. Exercises the full post-placement pipeline (auto-sync, cron,
 * buyer transition emails) without spending money. Hard-refuses in
 * production and when Prodigi isn't pointing at the sandbox URL.
 *
 * Creates:
 *  - A PrintOrder row using the first available artwork as the reference
 *  - A real Prodigi sandbox order via `POST /v4.0/orders`
 *  - Stage pre-advanced to `Placed` so the normal sync path applies
 *
 * Buyer email defaults to the admin's own Resend address so transition
 * emails are actually observable.
 */
export async function createSandboxTestOrder(): Promise<
  { ok: true; orderId: string; prodigiOrderId: string } | { ok: false; error: string }
> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Sandbox test orders are disabled in production.' }
  }
  const apiUrl = process.env.PRODIGI_API_URL ?? ''
  if (!apiUrl.includes('sandbox')) {
    return {
      ok: false,
      error: `Prodigi base URL is "${apiUrl}" (not sandbox). Refusing to create a paid test order. Point PRODIGI_API_URL at api.sandbox.prodigi.com and retry.`,
    }
  }

  const artwork = await prisma.artwork.findFirst({
    where: { OR: [{ imageUrl: { not: null } }, { originalImageUrl: { not: null } }] },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      originalImageUrl: true,
      userId: true,
      user: { select: { name: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!artwork) {
    return { ok: false, error: 'No artworks available to use as a test item. Upload one first.' }
  }

  const assetUrl = artwork.originalImageUrl ?? artwork.imageUrl
  if (!assetUrl) return { ok: false, error: 'Selected artwork has no image URL.' }

  // Stable sandbox-friendly unframed SKU. Hahnemühle Photo Rag 8x10.
  const sku = 'GLOBAL-HPR-8X10'

  let product
  try {
    const { getProduct } = await import('@/lib/prodigi/client')
    product = await getProduct(sku)
  } catch (err) {
    return {
      ok: false,
      error: `Could not fetch Prodigi product "${sku}": ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const attributes: Record<string, string> = {}
  for (const [name, values] of Object.entries(product.product.attributes)) {
    attributes[name] = values[0]
  }

  const pi = `pi_sandbox_test_${Date.now()}`
  const buyerEmail = guard.session.user.email ?? 'sandbox-test@theartroom.gallery'
  const buyerName = guard.session.user.name ?? 'Sandbox Test Buyer'

  const order = await prisma.printOrder.create({
    data: {
      paymentIntentId: pi,
      artworkId: artwork.id,
      artistUserId: artwork.userId,
      buyerEmail,
      buyerName,
      shippingAddress: {
        line1: '123 Test Street',
        line2: '',
        city: 'London',
        state: '',
        postalCode: 'W1A 1AA',
        country: 'GB',
        phone: '',
      },
      printConfig: {
        paperId: 'museum-cotton-rag',
        formatId: 'unframed',
        sizeId: '20x25',
        frameColorId: 'black',
        mountId: 'none',
        orientation: 'portrait',
        unit: 'cm',
      },
      country: 'GB',
      totalCents: 4500,
      artistCents: 1000,
      galleryCents: 1000,
      prodigiItemCents: 2000,
      prodigiShippingCents: 500,
      customerVatCents: 0,
      currency: 'eur',
      paymentStatus: 'succeeded',
    },
  })

  const { createOrder } = await import('@/lib/prodigi/client')
  let prodigiRes
  try {
    prodigiRes = await createOrder({
      merchantReference: order.id,
      shippingMethod: 'Standard',
      idempotencyKey: order.id,
      recipient: {
        name: buyerName,
        email: buyerEmail,
        address: {
          line1: '123 Test Street',
          townOrCity: 'London',
          postalOrZipCode: 'W1A 1AA',
          countryCode: 'GB',
        },
      },
      items: [
        {
          sku,
          copies: 1,
          sizing: 'fillPrintArea',
          attributes,
          assets: Object.keys(product.product.printAreas).map((pa) => ({
            printArea: pa,
            url: assetUrl,
          })),
        },
      ],
    })
  } catch (err) {
    // Roll back the DB row so failed test orders don't accumulate.
    await prisma.printOrder.delete({ where: { id: order.id } }).catch(() => null)
    return {
      ok: false,
      error: `Prodigi createOrder failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      prodigiOrderId: prodigiRes.order.id,
      prodigiStage: 'Placed',
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: 'Sandbox test order created',
    payload: {
      sku,
      prodigiOrderId: prodigiRes.order.id,
      outcome: prodigiRes.outcome,
    },
  })

  return { ok: true, orderId: order.id, prodigiOrderId: prodigiRes.order.id }
}

/**
 * Hard-delete an order from the DB, with safety guards. Intended for
 * cleaning up test/mistaken orders pre-launch. Refuses to delete any
 * order that has captured money we haven't returned yet, or where the
 * artist payout has already been released — those cases need a Refund
 * (to return buyer money) or a manual Stripe reversal first.
 *
 * If the payment is currently `authorized` (buyer's card on hold but
 * not charged), the Stripe PaymentIntent is cancelled first so the
 * hold releases.
 */
export async function deleteOrder(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }

  if (order.transferId) {
    return {
      ok: false,
      error: 'Artist payout already released — cannot delete. Recover funds from the artist first.',
    }
  }
  if (order.paymentStatus === 'succeeded') {
    return {
      ok: false,
      error: 'Payment was captured. Refund the buyer first; only then can the order be deleted.',
    }
  }

  // Release the Stripe hold before removing the order row — otherwise
  // the auth sits on the buyer's card until Stripe expires it (~7 days).
  if (order.paymentStatus === 'authorized') {
    try {
      await stripe.paymentIntents.cancel(order.paymentIntentId)
    } catch (err) {
      captureError(err, {
        flow: 'admin',
        stage: 'delete-order-cancel-pi',
        extra: { orderId, paymentIntentId: order.paymentIntentId },
        level: 'error',
        fingerprint: ['admin:delete-cancel-pi-failed'],
      })
      return {
        ok: false,
        error: `Stripe cancel failed: ${err instanceof Error ? err.message : String(err)}. Order not deleted.`,
      }
    }
  }

  try {
    await prisma.$transaction([
      prisma.printOrderEvent.deleteMany({ where: { orderId } }),
      prisma.printOrder.delete({ where: { id: orderId } }),
    ])
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'delete-order-db',
      extra: { orderId, paymentStatus: order.paymentStatus },
      level: 'error',
      fingerprint: ['admin:delete-order-db-failed'],
    })
    return {
      ok: false,
      error: `Database delete failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return { ok: true }
}

/**
 * Manual-fulfillment stage the admin has advanced the order to. Maps to
 * the PrintOrder.prodigiStage column, replacing Prodigi's raw vocabulary
 * with a flow that makes sense for admin-placed orders.
 */
const STAGE_PENDING = null // buyer paid, not yet placed in Prodigi
const STAGE_PLACED = 'Placed' // admin placed in Prodigi; payment captured
const STAGE_STARTED = 'Started' // Prodigi started production
const STAGE_SHIPPED = 'Shipped' // Prodigi shipped
const STAGE_COMPLETE = 'Complete' // delivered; 14-day payout clock starts
const STAGE_REJECTED = 'Rejected' // Prodigi rejected / cancelled

/**
 * Admin CTA: we just placed the order in the Prodigi dashboard by hand,
 * and got back a Prodigi order ID. Capture the Stripe auth (auth →
 * succeeded) and record the link so future sync calls can find it.
 */
export async function markPlacedInProdigi(
  orderId: string,
  prodigiOrderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const trimmed = prodigiOrderId.trim()
  if (!trimmed) return { ok: false, error: 'Prodigi order ID is required.' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.prodigiStage !== STAGE_PENDING) {
    return { ok: false, error: `Already advanced past pending (stage: ${order.prodigiStage}).` }
  }
  if (order.paymentStatus !== 'authorized') {
    return {
      ok: false,
      error: `Payment must be authorized to capture (current: ${order.paymentStatus}).`,
    }
  }

  try {
    await stripe.paymentIntents.capture(order.paymentIntentId)
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'mark-placed-capture',
      extra: { orderId, paymentIntentId: order.paymentIntentId },
      level: 'error',
      fingerprint: ['admin:mark-placed-capture-failed'],
    })
    return {
      ok: false,
      error: `Stripe capture failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      prodigiOrderId: trimmed,
      prodigiStage: STAGE_PLACED,
      paymentStatus: 'succeeded',
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: 'Marked placed in Prodigi (payment captured)',
    payload: { prodigiOrderId: trimmed },
  })

  return { ok: true }
}

/**
 * Admin CTA: Prodigi rejected the order (bad file, SKU mismatch, etc.).
 * Terminal state. If payment was still authorized we cancel the Stripe
 * PI (releases the hold); if it was already captured, admin must use
 * the existing Refund flow to return funds.
 */
export async function markRejected(
  orderId: string,
  reason: string,
): Promise<{ ok: true; needsRefund: boolean } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard

  const trimmedReason = reason.trim()
  if (!trimmedReason) return { ok: false, error: 'A reason is required.' }

  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (order.prodigiStage === STAGE_COMPLETE || order.prodigiStage === STAGE_REJECTED) {
    return { ok: false, error: `Cannot reject from stage "${order.prodigiStage}".` }
  }

  let voided = false
  if (order.paymentStatus === 'authorized') {
    try {
      await stripe.paymentIntents.cancel(order.paymentIntentId)
      voided = true
    } catch (err) {
      captureError(err, {
        flow: 'admin',
        stage: 'mark-rejected-cancel-pi',
        extra: { orderId, paymentIntentId: order.paymentIntentId },
        level: 'error',
        fingerprint: ['admin:mark-rejected-cancel-failed'],
      })
      return {
        ok: false,
        error: `Stripe cancel failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      prodigiStage: STAGE_REJECTED,
      ...(voided ? { paymentStatus: 'canceled' } : {}),
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'admin_action',
    actor: `admin:${guard.session.user.id}`,
    message: voided
      ? 'Marked rejected (Stripe auth voided)'
      : 'Marked rejected (manual refund required)',
    payload: { reason: trimmedReason, voided, priorPaymentStatus: order.paymentStatus },
  })

  // Fire the buyer cancellation email + admin alert via the shared
  // transition handler. Event-log idempotent — if sync later picks up
  // the same Rejected state, emails won't re-send.
  await maybeSendBuyerTransitionEmail(order.id, STAGE_REJECTED, {
    trackingUrl: null,
    source: 'admin',
  })

  // needsRefund tells the UI to surface the existing refund flow.
  const needsRefund = order.paymentStatus === 'succeeded' && !order.transferId
  return { ok: true, needsRefund }
}

/**
 * Fetches the latest state from Prodigi (`GET /orders/{id}`), maps it
 * into our stage vocabulary, and updates the PrintOrder row if anything
 * changed. Logs a single event per change. Admin-session-gated; the
 * cron + any system caller uses `syncOrderFromProdigiCore` directly.
 *
 * Called on-demand: when admin opens the order detail page, and when
 * they click "Refresh from Prodigi". We never call Prodigi if the stage
 * is terminal (Complete or Rejected) — nothing more to sync.
 */
export async function syncOrderFromProdigi(
  orderId: string,
): Promise<{ ok: true; changed: boolean; stage: string | null } | { ok: false; error: string }> {
  const guard = await requireAdminSession()
  if (!guard.ok) return guard
  return syncOrderFromProdigiCore(orderId)
}

/**
 * Session-free variant of `syncOrderFromProdigi` — same logic, no
 * require-admin guard. Exported so the cron route (which has no
 * session) can reuse it without duplicating the Prodigi read + DB
 * update path.
 */
export async function syncOrderFromProdigiCore(
  orderId: string,
): Promise<{ ok: true; changed: boolean; stage: string | null } | { ok: false; error: string }> {
  const order = await prisma.printOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found.' }
  if (!order.prodigiOrderId) {
    return { ok: false, error: 'No Prodigi order ID on file — mark placed first.' }
  }
  if (order.prodigiStage === STAGE_COMPLETE || order.prodigiStage === STAGE_REJECTED) {
    return { ok: true, changed: false, stage: order.prodigiStage }
  }

  const { getOrder } = await import('@/lib/prodigi/client')
  let prodigi
  try {
    prodigi = await getOrder(order.prodigiOrderId)
  } catch (err) {
    captureError(err, {
      flow: 'admin',
      stage: 'prodigi-sync',
      extra: { orderId, prodigiOrderId: order.prodigiOrderId },
      level: 'warning',
      fingerprint: ['admin:prodigi-sync-failed'],
    })
    return {
      ok: false,
      error: `Prodigi fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const mappedStage = mapProdigiStage(prodigi.order)
  const trackingUrl = prodigi.order.shipments?.[0]?.tracking?.url ?? null

  const stageChanged = mappedStage !== order.prodigiStage
  const trackingChanged = trackingUrl && trackingUrl !== order.trackingUrl

  if (!stageChanged && !trackingChanged) {
    return { ok: true, changed: false, stage: order.prodigiStage }
  }

  // When we first land on Complete, stamp shippedAt = now so the 14-day
  // payout-eligibility clock starts from this moment. The column name
  // is historical — in manual-fulfillment mode it really means "payout
  // clock start".
  const goingComplete = mappedStage === STAGE_COMPLETE && order.prodigiStage !== STAGE_COMPLETE

  await prisma.printOrder.update({
    where: { id: order.id },
    data: {
      prodigiStage: mappedStage,
      ...(trackingUrl ? { trackingUrl } : {}),
      ...(goingComplete ? { shippedAt: new Date() } : {}),
    },
  })

  await logOrderEvent({
    orderId: order.id,
    kind: 'prodigi_status_changed',
    actor: 'system',
    message: `Stage advanced to ${mappedStage} (via Prodigi sync)`,
    payload: {
      previousStage: order.prodigiStage,
      newStage: mappedStage,
      prodigiStage: prodigi.order.status.stage,
      trackingUrl,
      issues: prodigi.order.status.issues,
      // Per-phase detail states (downloadAssets, printReadyAssetsPrepared,
      // allocateProductionLocation, inProduction, shipping). Any `Error`
      // value here surfaces as a warning banner on the admin detail page.
      details: prodigi.order.status.details,
    },
  })

  // Buyer-facing transition emails. Event-log gated so the cron + admin
  // open + manual refresh never triple-send the same notification.
  if (stageChanged) {
    await maybeSendBuyerTransitionEmail(order.id, mappedStage, {
      trackingUrl,
    })
  }

  return { ok: true, changed: true, stage: mappedStage }
}

/**
 * Send the buyer (and optionally admin) the appropriate transition
 * email for a stage change, gated by the event log so retries never
 * double-send. Called from both the Prodigi sync and the admin-initiated
 * `markRejected` server action.
 */
async function maybeSendBuyerTransitionEmail(
  orderId: string,
  newStage: string,
  opts: { trackingUrl: string | null; source?: 'prodigi-sync' | 'admin' },
): Promise<void> {
  if (newStage !== STAGE_STARTED && newStage !== STAGE_SHIPPED && newStage !== STAGE_REJECTED) {
    return
  }

  const emailMessageKey =
    newStage === STAGE_STARTED
      ? 'order_in_production'
      : newStage === STAGE_SHIPPED
        ? 'order_shipped'
        : 'order_cancelled'

  const alreadySent = await prisma.printOrderEvent.findFirst({
    where: { orderId, kind: 'email_sent', message: emailMessageKey },
    select: { id: true },
  })
  if (alreadySent) return

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      artwork: { select: { title: true } },
      artistUser: { select: { name: true, lastName: true } },
    },
  })
  if (!order || !order.buyerEmail) return

  const artistName = [order.artistUser.name, order.artistUser.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  const emailRes =
    newStage === STAGE_STARTED
      ? await sendOrderInProductionEmail({
          to: order.buyerEmail,
          buyerName: order.buyerName,
          orderId: order.id,
          artworkTitle: order.artwork.title ?? '',
          artistName,
        })
      : newStage === STAGE_SHIPPED
        ? await sendOrderShippedEmail({
            to: order.buyerEmail,
            buyerName: order.buyerName,
            orderId: order.id,
            artworkTitle: order.artwork.title ?? '',
            artistName,
            trackingUrl: opts.trackingUrl,
          })
        : await sendOrderCancelledEmail({
            to: order.buyerEmail,
            buyerName: order.buyerName,
            orderId: order.id,
            artworkTitle: order.artwork.title ?? '',
            artistName,
            paymentStatus: order.paymentStatus,
          })

  await logOrderEvent({
    orderId: order.id,
    kind: emailRes.ok ? 'email_sent' : 'email_failed',
    actor: 'system',
    message: emailMessageKey,
    payload: emailRes.ok
      ? { to: order.buyerEmail, resendId: emailRes.id }
      : { to: order.buyerEmail, error: emailRes.error },
  })

  if (!emailRes.ok) {
    captureError(new Error(`Buyer ${emailMessageKey} email failed: ${emailRes.error}`), {
      flow: 'email',
      stage: `buyer-${emailMessageKey}-send`,
      extra: { orderId: order.id, to: order.buyerEmail, error: emailRes.error },
      level: 'warning',
      fingerprint: [`email:${emailMessageKey}-failed`],
    })
  }

  // Cancellation also triggers an admin alert so the team knows a refund
  // may be needed (especially when Prodigi cancelled on their side and
  // we wouldn't otherwise notice until opening the dashboard).
  if (newStage === STAGE_REJECTED) {
    const adminAlreadySent = await prisma.printOrderEvent.findFirst({
      where: { orderId, kind: 'email_sent', message: 'admin_order_cancelled' },
      select: { id: true },
    })
    if (!adminAlreadySent) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://theartroom.gallery'
      const adminRes = await sendAdminOrderCancelledAlert({
        orderId: order.id,
        prodigiOrderId: order.prodigiOrderId,
        artworkTitle: order.artwork.title ?? '',
        artistName,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        paymentStatus: order.paymentStatus,
        totalCents: order.totalCents,
        currency: order.currency,
        adminOrderUrl: `${siteUrl}/admin/orders/${order.id}`,
        source: opts.source ?? 'prodigi-sync',
      })
      await logOrderEvent({
        orderId: order.id,
        kind: adminRes.ok ? 'email_sent' : 'email_failed',
        actor: 'system',
        message: 'admin_order_cancelled',
        payload: adminRes.ok ? { resendId: adminRes.id } : { error: adminRes.error },
      })
      if (!adminRes.ok) {
        captureError(new Error(`Admin cancellation alert failed: ${adminRes.error}`), {
          flow: 'email',
          stage: 'admin-order-cancelled-send',
          extra: { orderId: order.id, error: adminRes.error },
          level: 'warning',
          fingerprint: ['email:admin-order-cancelled-failed'],
        })
      }
    }
  }
}

/**
 * Map Prodigi's raw state (stage + details + shipments) into our
 * simpler manual-flow stages. See STAGE_* constants above.
 *
 * Prodigi's documented vocabulary:
 *   status.stage:     'InProgress' | 'Complete' | 'Cancelled'
 *   status.details.*: 'NotStarted' | 'InProgress' | 'Complete' | 'Error'
 *   shipments[].status: 'Processing' | 'Cancelled' | 'Shipped'
 *
 * Step 6 of their process = inProduction moves to InProgress (print
 * starts). Step 8 = a shipment's status becomes 'Shipped'. The top-level
 * stage becomes 'Complete' once all shipments have been sent.
 */
function mapProdigiStage(prodigiOrder: {
  status: { stage: string; details: Record<string, string> }
  shipments: Array<{ status?: string }>
}): string {
  if (prodigiOrder.status.stage === 'Complete') return STAGE_COMPLETE
  if (prodigiOrder.status.stage === 'Cancelled') return STAGE_REJECTED

  const anyShipped = prodigiOrder.shipments?.some((s) => s.status === 'Shipped')
  if (anyShipped) return STAGE_SHIPPED

  const inProd = prodigiOrder.status.details?.inProduction
  if (inProd === 'InProgress' || inProd === 'Complete') return STAGE_STARTED

  return STAGE_PLACED
}
