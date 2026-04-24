import { timingSafeEqual } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import type { ProdigiOrder } from '@/lib/prodigi/types'
import { logOrderEvent } from '@/lib/orders/logOrderEvent'
import { captureError } from '@/lib/observability/captureError'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const webhookSecret = process.env.PRODIGI_WEBHOOK_SECRET

/**
 * Constant-time comparison so an attacker can't recover the webhook
 * secret byte-by-byte from response-timing differences. `timingSafeEqual`
 * requires equal-length inputs, so we length-check first — falling
 * through to `false` when the lengths differ.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Prodigi doesn't HMAC-sign its callbacks and its API v4 callback config
 * only accepts a plain URL string — no custom headers, no signatures.
 * We gate on a shared secret that Prodigi can send either as a
 * querystring param (`?key=...`) or as an `X-Prodigi-Secret` header,
 * and compare it in constant time.
 *
 * Configure the URL in the Prodigi dashboard as:
 *   https://theartroom.gallery/api/webhooks/prodigi?key=<PRODIGI_WEBHOOK_SECRET>
 *
 * Operational note: rotate PRODIGI_WEBHOOK_SECRET periodically (it
 * lives in Prodigi's logs and retry records), and keep it long + random
 * (>= 32 hex chars from `openssl rand -hex 32`).
 *
 * Payload shape is the full Order object (same as GET /orders/{id}).
 */
export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error('[prodigi-webhook] PRODIGI_WEBHOOK_SECRET is not configured.')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 })
  }

  const provided = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-prodigi-secret') ?? ''
  if (!provided || !secretsMatch(provided, webhookSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { order?: ProdigiOrder } | ProdigiOrder
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Prodigi's callback sometimes wraps the order in `{ order: {...} }` and
  // sometimes sends the order object directly. Handle both.
  const order: ProdigiOrder | undefined =
    'order' in (body as object) ? (body as { order?: ProdigiOrder }).order : (body as ProdigiOrder)
  if (!order?.id) {
    return NextResponse.json({ error: 'Missing order.id' }, { status: 400 })
  }

  try {
    const stage = order.status?.stage ?? null
    const shipment = order.shipments?.[0]
    const trackingUrl = shipment?.tracking?.url ?? null
    const shippedAt = shipment?.dispatchDate ? new Date(shipment.dispatchDate) : null

    const existing = await prisma.printOrder.findFirst({
      where: { prodigiOrderId: order.id },
      select: { id: true, paymentIntentId: true, paymentStatus: true, prodigiStage: true },
    })
    if (!existing) {
      console.warn(`[prodigi-webhook] No PrintOrder found for prodigiOrderId=${order.id}`)
      return NextResponse.json({ received: true })
    }

    await prisma.printOrder.update({
      where: { id: existing.id },
      data: { prodigiStage: stage, trackingUrl, shippedAt },
    })

    const stageChanged = stage !== existing.prodigiStage
    if (stageChanged) {
      await logOrderEvent({
        orderId: existing.id,
        kind: stage === 'Cancelled' ? 'prodigi_cancelled' : 'prodigi_status_changed',
        actor: 'prodigi',
        message: `Prodigi stage: ${existing.prodigiStage ?? '∅'} → ${stage ?? '∅'}`,
        payload: { stage, details: order.status?.details, issues: order.status?.issues },
      })
    }

    // Surface any non-empty issues as their own event so they're easy to
    // spot in the admin timeline without trawling payloads.
    if ((order.status?.issues?.length ?? 0) > 0) {
      await logOrderEvent({
        orderId: existing.id,
        kind: 'prodigi_issue',
        actor: 'prodigi',
        message: `Prodigi reported ${order.status?.issues.length} issue(s)`,
        payload: { issues: order.status?.issues },
      })
    }

    // Capture the buyer's authorized payment once Prodigi has committed
    // to producing the order. `allocateProductionLocation === 'Complete'`
    // means a lab has been assigned and production is imminent (or has
    // already started), which is when Prodigi will also charge our
    // company card on their side.
    if (
      existing.paymentStatus === 'authorized' &&
      order.status?.details?.allocateProductionLocation === 'Complete' &&
      (order.status.issues?.length ?? 0) === 0
    ) {
      try {
        await stripe.paymentIntents.capture(existing.paymentIntentId)
        console.log(
          `[prodigi-webhook] captured payment for order=${existing.id} pi=${existing.paymentIntentId}`,
        )
        // The `captured` event is logged by the Stripe webhook when the
        // payment_intent.succeeded event arrives next. No event here to
        // avoid double-logging.
      } catch (err) {
        // Capture failed after Prodigi committed to production. Cancel the
        // Prodigi order so they don't ship something we won't be paid for.
        console.error(
          `[prodigi-webhook] capture failed for order=${existing.id} pi=${existing.paymentIntentId}:`,
          err,
        )
        await logOrderEvent({
          orderId: existing.id,
          kind: 'capture_failed',
          actor: 'system',
          message: 'Stripe capture failed after Prodigi production allocation',
          payload: { error: err instanceof Error ? err.message : String(err) },
        })
        // CRITICAL: Prodigi is producing but we couldn't collect from
        // the buyer. Needs an operator immediately — either capture
        // failed for a recoverable reason (retry manually) or we need
        // to cancel Prodigi before they ship.
        captureError(err, {
          flow: 'payment',
          stage: 'capture-failed',
          extra: {
            orderId: existing.id,
            paymentIntentId: existing.paymentIntentId,
            prodigiOrderId: order.id,
          },
          level: 'fatal',
          fingerprint: ['payment:capture-failed'],
        })
        // MANUAL FULFILLMENT MODE (2026-04-24): auto-cancel to Prodigi is
        // disabled. In practice this branch won't fire — we aren't
        // submitting orders to Prodigi, so Prodigi will never webhook us
        // about a capture-failed-during-production case. Left as a
        // tripwire: if it ever does fire, admin must cancel manually in
        // the Prodigi dashboard.
        await logOrderEvent({
          orderId: existing.id,
          kind: 'note',
          actor: 'system',
          message: 'MANUAL ACTION REQUIRED: cancel Prodigi order in dashboard (auto-cancel disabled)',
          payload: { prodigiOrderId: order.id },
        })
        await prisma.printOrder.update({
          where: { id: existing.id },
          data: { paymentStatus: 'failed' },
        })
      }
    }
  } catch (err) {
    console.error('[prodigi-webhook] update failed:', err)
    captureError(err, {
      flow: 'webhook',
      stage: 'prodigi-handler-threw',
      extra: { prodigiOrderId: order.id, stage: order.status?.stage },
      level: 'error',
    })
  }

  return NextResponse.json({ received: true })
}
