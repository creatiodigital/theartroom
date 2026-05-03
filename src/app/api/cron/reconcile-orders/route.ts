import { NextRequest, NextResponse } from 'next/server'

import { sendAdminCriticalAlert } from '@/lib/emails/adminCriticalAlert'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Hourly safety-net cron. Lists Stripe PaymentIntents from the last 24h
 * that originated from our wizard (have wizardConfig metadata) and are
 * in a state that means the webhook *should* have created an order
 * (`requires_capture`, `succeeded`, or `processing`). If any of those
 * have no matching PrintOrder row in our DB, sends a single alert email
 * listing the orphans so the admin can recover them by hand.
 *
 * Why this exists: the Stripe webhook is the only thing that creates
 * PrintOrder rows. If the webhook fails to deliver (mid-deploy, DNS
 * blip, our app down), Stripe retries for ~3 days then drops it. This
 * cron catches the gap within an hour.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` on every
 * scheduled invocation. We reject anything else with 401 to keep this
 * endpoint from being scraped.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron/reconcile-orders] CRON_SECRET not configured.')
    return NextResponse.json({ error: 'Cron not configured.' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // 24h lookback. Stripe retries failed webhooks for up to 3 days; an
  // hourly cron with a 24h window catches any orphan within an hour of
  // it stabilising.
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)

  // Skip PIs younger than this — webhook delivery has its own retry
  // window, and we don't want to alert on a transient delay that will
  // resolve itself within minutes.
  const minAgeSeconds = 30 * 60
  const cutoff = Math.floor(Date.now() / 1000) - minAgeSeconds

  let stripePIs: Awaited<ReturnType<typeof stripe.paymentIntents.list>>['data'] = []
  try {
    // Single page is enough — 100 PIs in 24h is well above expected
    // launch volume. If that ever stops being true, paginate.
    const list = await stripe.paymentIntents.list({
      created: { gte: since },
      limit: 100,
    })
    stripePIs = list.data
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      flow: 'cron',
      stage: 'reconcile-orders-list-pis',
      level: 'error',
      fingerprint: ['cron:reconcile-list-pis-failed'],
    })
    return NextResponse.json(
      { error: 'Could not list PaymentIntents from Stripe.' },
      { status: 500 },
    )
  }

  // Only consider PIs that:
  //  - originated from our wizard (have a wizardConfig metadata field)
  //  - are in a state where an order should exist
  //  - are at least minAgeSeconds old (let webhook retries finish first)
  const ourPIs = stripePIs.filter((pi) => {
    if (!pi.metadata?.wizardConfig) return false
    if (pi.created > cutoff) return false
    return (
      pi.status === 'requires_capture' || pi.status === 'succeeded' || pi.status === 'processing'
    )
  })

  if (ourPIs.length === 0) {
    return NextResponse.json({ checked: 0, orphans: 0 })
  }

  const piIds = ourPIs.map((p) => p.id)
  const existing = await prisma.printOrder.findMany({
    where: { paymentIntentId: { in: piIds } },
    select: { paymentIntentId: true },
  })
  const existingIds = new Set(existing.map((o) => o.paymentIntentId))

  const orphans = ourPIs.filter((pi) => !existingIds.has(pi.id))

  if (orphans.length > 0) {
    const orphanLines = orphans
      .map((pi) => {
        const ageMin = Math.round((Date.now() / 1000 - pi.created) / 60)
        const total = pi.amount
          ? `${(pi.amount / 100).toFixed(2)} ${pi.currency.toUpperCase()}`
          : '?'
        return `${pi.id} — ${pi.status} — ${total} — ${ageMin}m old — ${pi.receipt_email ?? 'no email'}`
      })
      .join('\n')

    await sendAdminCriticalAlert({
      title: `${orphans.length} paid PaymentIntent${orphans.length === 1 ? '' : 's'} with no order row`,
      problem: `The hourly reconciliation job found ${orphans.length} Stripe PaymentIntent${orphans.length === 1 ? '' : 's'} from the last 24h that should have created a PrintOrder row but didn't. These are silent webhook failures — the buyer was charged or has a card hold, and no order is visible in /admin/orders.\n\n${orphanLines}`,
      context: { orphanCount: orphans.length, checkedCount: ourPIs.length },
      whatToDo: [
        'Open each PaymentIntent in Stripe and confirm it really has no PrintOrder (search by PI id in your DB).',
        'For each orphan: open Stripe → grab the wizardConfig metadata + shipping address → recreate the order manually.',
        'If you cannot recover an order, refund the buyer and contact them to re-place.',
        'Until each orphan is resolved, this alert will fire again every hour. To stop the alert: create the missing PrintOrder row, refund the buyer, or cancel the PaymentIntent.',
      ],
    })
  }

  return NextResponse.json({
    checked: ourPIs.length,
    orphans: orphans.length,
    orphanIds: orphans.map((p) => p.id),
  })
}
