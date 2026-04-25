import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

type OrderInProductionArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
}

/**
 * Sent to the buyer once Prodigi has started producing the print
 * (stage transitions to `Started`). Bridge between the initial "order
 * received" email and the shipping notification.
 *
 * Resolves `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the sync.
 */
export async function sendOrderInProductionEmail(
  args: OrderInProductionArgs,
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
      subject: 'Your print is being produced',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your print is being produced</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeBuyerName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Good news &mdash; your print is now being produced by our fine-art print lab.
          </p>

          <p style="margin: 0 0 24px 0; line-height: 1.55;">
            We&rsquo;ll send you another email with tracking details as soon as it ships.
          </p>

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 8px 0;"><strong>Order</strong> #${safeOrderId}</p>
            <p style="margin:0;">${safeArtwork} &mdash; ${safeArtist}</p>
          </div>

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
