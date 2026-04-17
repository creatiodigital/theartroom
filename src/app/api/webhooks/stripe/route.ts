import { NextRequest, NextResponse } from 'next/server'

import { createPrintOrderFromPaymentIntent } from '@/lib/orders/createPrintOrderFromPaymentIntent'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeEvent = ReturnType<typeof stripe.webhooks.constructEvent>

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured.')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: StripeEvent
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.warn('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as AccountLike)
        break
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as PaymentIntentLike)
        break
      case 'payment_intent.processing':
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as PaymentIntentLike
        await prisma.printOrder
          .updateMany({
            where: { paymentIntentId: pi.id },
            data: {
              paymentStatus:
                event.type === 'payment_intent.payment_failed' ? 'failed' : 'processing',
            },
          })
          .catch((err) => console.warn('[stripe-webhook] update paymentStatus failed:', err))
        break
      }
      default:
        break
    }
  } catch (err) {
    // Never return 5xx here — Stripe will retry indefinitely. Log and ack
    // so we can investigate manually. Business-level retry happens via
    // admin actions in /admin/orders.
    console.error(`[stripe-webhook] ${event.type} handler threw:`, err)
  }

  return NextResponse.json({ received: true })
}

// Minimal shapes for the two Stripe objects we care about. Avoids pulling
// the full Stripe.* namespace (not cleanly reachable under CJS types).
type AccountLike = {
  id: string
  details_submitted?: boolean
  payouts_enabled?: boolean
}

type PaymentIntentLike = {
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

async function handleAccountUpdated(account: AccountLike) {
  const complete = Boolean(account.details_submitted && account.payouts_enabled)
  const res = await prisma.user.updateMany({
    where: { stripeAccountId: account.id },
    data: { stripeOnboardingComplete: complete },
  })
  if (res.count === 0) {
    console.warn(`[stripe-webhook] account.updated for unknown account ${account.id}`)
  }
}

async function handlePaymentIntentSucceeded(pi: PaymentIntentLike) {
  const res = await createPrintOrderFromPaymentIntent(pi)
  if (!res.ok) {
    console.error(
      `[stripe-webhook] payment_intent.succeeded pi=${pi.id} → order creation failed: ${res.error}`,
    )
    return
  }
  console.log(
    `[stripe-webhook] payment_intent.succeeded pi=${pi.id} → order=${res.orderId} prodigi=${res.prodigiOrderId ?? '(pending/skipped)'}`,
  )
}
