import prisma from '@/lib/prisma'

export type OrderEventKind =
  // Stripe lifecycle
  | 'auth_received'
  | 'auth_canceled'
  | 'payment_processing'
  | 'payment_failed'
  | 'captured'
  | 'capture_failed'
  // Prodigi lifecycle
  | 'prodigi_submitted'
  | 'prodigi_submit_failed'
  | 'prodigi_status_changed'
  | 'prodigi_cancelled'
  | 'prodigi_issue'
  // Our side
  | 'email_sent'
  | 'email_failed'
  | 'admin_action'
  | 'note'

export type OrderEventActor = 'stripe' | 'prodigi' | 'system' | `admin:${string}`

/**
 * Append an audit event to a PrintOrder. Never throws — logging failures
 * must not block webhook processing or payment flows. Console-warns on
 * failure so we can still investigate via server logs.
 */
export async function logOrderEvent(args: {
  orderId: string
  kind: OrderEventKind
  actor: OrderEventActor
  message?: string
  payload?: unknown
}): Promise<void> {
  try {
    await prisma.printOrderEvent.create({
      data: {
        orderId: args.orderId,
        kind: args.kind,
        actor: args.actor,
        message: args.message,
        payload: (args.payload ?? undefined) as object | undefined,
      },
    })
  } catch (err) {
    console.warn(
      `[logOrderEvent] failed to persist event kind=${args.kind} order=${args.orderId}:`,
      err,
    )
  }
}
