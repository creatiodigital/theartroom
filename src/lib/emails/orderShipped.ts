import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

type OrderShippedArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  trackingUrl: string | null
}

/**
 * Sent to the buyer once Prodigi has handed the package to the carrier
 * (a shipment's status transitions to `Shipped`). Includes the tracking
 * URL if Prodigi provided one — most shipments do.
 *
 * Resolves `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the sync.
 */
export async function sendOrderShippedEmail(
  args: OrderShippedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeBuyerName = escapeHtml(args.buyerName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))
  const safeTrackingUrl = args.trackingUrl ? escapeHtml(args.trackingUrl) : null

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Your artwork is on its way',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your artwork is on its way</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeBuyerName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Your print has shipped. It&rsquo;s now in the carrier&rsquo;s hands and heading your way.
          </p>

          ${
            safeTrackingUrl
              ? `<p style="margin: 0 0 24px 0;">
                   <a href="${safeTrackingUrl}" style="background:#111;color:#fff;padding:10px 18px;text-decoration:none;display:inline-block;">Track your shipment</a>
                 </p>`
              : ''
          }

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 8px 0;"><strong>Order</strong> #${safeOrderId}</p>
            <p style="margin:0;">${safeArtwork} &mdash; ${safeArtist}</p>
          </div>

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            Please unwrap carefully when it arrives. If anything looks wrong on delivery, just
            reply to this email with a photo and we&rsquo;ll sort it out.
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
