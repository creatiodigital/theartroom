'use server'

import { auth } from '@/auth'
import { isAdminOrAbove } from '@/lib/authUtils'
import { sendArtistPayoutEmail } from '@/lib/emails/artistPayout'
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
