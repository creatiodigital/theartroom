import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/lib/prisma'
import type { ProdigiOrder } from '@/lib/prodigi/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const webhookSecret = process.env.PRODIGI_WEBHOOK_SECRET

/**
 * Prodigi doesn't HMAC-sign its callbacks, so we gate the endpoint on a
 * shared secret in the querystring (`?key=...`) or `X-Prodigi-Secret`
 * header. Configure the URL in the Prodigi dashboard as:
 *   https://theartroom.gallery/api/webhooks/prodigi?key=<PRODIGI_WEBHOOK_SECRET>
 *
 * Payload shape is the full Order object (same as GET /orders/{id}).
 */
export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error('[prodigi-webhook] PRODIGI_WEBHOOK_SECRET is not configured.')
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 })
  }

  const provided = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-prodigi-secret') ?? ''
  if (provided !== webhookSecret) {
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

    const res = await prisma.printOrder.updateMany({
      where: { prodigiOrderId: order.id },
      data: {
        prodigiStage: stage,
        trackingUrl,
        shippedAt,
      },
    })
    if (res.count === 0) {
      console.warn(`[prodigi-webhook] No PrintOrder found for prodigiOrderId=${order.id}`)
    }
  } catch (err) {
    console.error('[prodigi-webhook] update failed:', err)
  }

  return NextResponse.json({ received: true })
}
