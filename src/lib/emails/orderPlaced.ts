import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}

type OrderPlacedArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  totalCents: number
  currency: string
}

/**
 * Sent to the buyer immediately after their card authorization succeeds.
 * The charge happens later, once the print enters production — the copy
 * explicitly calls this out so the buyer isn't surprised by a delayed
 * charge.
 *
 * Resolves with `{ ok: false }` on failure rather than throwing, so the
 * caller can log + continue without aborting the webhook.
 */
export async function sendOrderPlacedEmail(
  args: OrderPlacedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeBuyerName = escapeHtml(args.buyerName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))
  const total = formatAmount(args.totalCents, args.currency)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Your order at The Art Room has been placed',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your order has been placed</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeBuyerName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Thanks for your order. We&rsquo;ve received all your details and your print is being prepared.
          </p>

          <p style="margin: 0 0 24px 0; line-height: 1.55;">
            A temporary hold has been placed on your card &mdash; we&rsquo;ll only charge it once your print
            enters production. You&rsquo;ll get another email from us when that happens, and one more
            with tracking details as soon as it ships.
          </p>

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 8px 0;"><strong>Order</strong> #${safeOrderId}</p>
            <p style="margin:0 0 8px 0;">${safeArtwork} &mdash; ${safeArtist}</p>
            <p style="margin:0;"><strong>Total</strong> ${total}</p>
          </div>

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            If anything changes with your order, we&rsquo;ll be in touch right away.
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
