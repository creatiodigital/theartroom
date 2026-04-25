import { NextResponse } from 'next/server'

import { syncOrderFromProdigiCore } from '@/app/admin/orders/actions'
import { captureError } from '@/lib/observability/captureError'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily cron: pulls the latest state from Prodigi for every non-terminal
 * order and dispatches buyer-facing transition emails when stages
 * advance. Keeps buyers informed even when no admin has opened the
 * dashboard today.
 *
 * Secured via a bearer token (`CRON_SECRET`) that Vercel Cron sets
 * automatically in the Authorization header for scheduled invocations.
 * Manual callers must pass the same token explicitly.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const provided = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const openOrders = await prisma.printOrder.findMany({
    where: {
      prodigiOrderId: { not: null },
      prodigiStage: { notIn: ['Complete', 'Rejected', 'Cancelled'] },
    },
    select: { id: true },
    take: 500,
  })

  const results: Array<{ orderId: string; ok: boolean; changed?: boolean; error?: string }> = []

  for (const { id } of openOrders) {
    try {
      const res = await syncOrderFromProdigiCore(id)
      if (res.ok) {
        results.push({ orderId: id, ok: true, changed: res.changed })
      } else {
        results.push({ orderId: id, ok: false, error: res.error })
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({ orderId: id, ok: false, error })
      captureError(err, {
        flow: 'order',
        stage: 'cron-sync-orders',
        extra: { orderId: id },
        level: 'warning',
        fingerprint: ['cron:sync-orders-failed'],
      })
    }
  }

  const changed = results.filter((r) => r.ok && r.changed).length
  const failed = results.filter((r) => !r.ok).length

  return NextResponse.json({
    ok: true,
    scanned: openOrders.length,
    changed,
    failed,
    results,
  })
}
