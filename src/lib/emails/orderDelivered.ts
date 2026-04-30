import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

type OrderDeliveredArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
}

/**
 * Sent to the buyer once the buyer receives delivery (admin marks
 * the shipment `Complete`, or admin manually advances an order to
 * the equivalent stage). Closes the loop on the long, multi-week print
 * journey so the buyer doesn't keep wondering whether the package is
 * still in transit.
 *
 * Resolves `{ ok: false }` on failure rather than throwing — the caller
 * logs and continues.
 */
export async function sendOrderDeliveredEmail(
  args: OrderDeliveredArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeBuyerName = escapeHtml(args.buyerName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Your artwork has arrived',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your artwork has arrived</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeBuyerName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Your print should be in your hands now. We hope it looks every bit as good as it did
            on screen &mdash; and even better in the flesh.
          </p>

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 8px 0;"><strong>Order</strong> #${safeOrderId}</p>
            <p style="margin:0;">${safeArtwork} &mdash; ${safeArtist}</p>
          </div>

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            If anything looks wrong &mdash; damaged in transit, mis-printed, or simply not what you
            expected &mdash; just reply to this email with a photo and we&rsquo;ll make it right.
          </p>

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            Otherwise, enjoy living with the work. The artist will receive their payout shortly.
          </p>

          <p style="margin: 24px 0 0 0; color:#666; font-size: 13px;">&mdash; The Art Room</p>
        </div>
      `,
    })

    if (res.error) {
      return { ok: false, error: res.error.message ?? 'resend error' }
    }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
