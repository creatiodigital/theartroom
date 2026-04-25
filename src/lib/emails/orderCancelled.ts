import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

type PaymentState = 'authorized' | 'canceled' | 'succeeded' | 'refunded' | string

type OrderCancelledArgs = {
  to: string
  buyerName: string
  orderId: string
  artworkTitle: string
  artistName: string
  /** Current payment state — shapes the refund-language in the email. */
  paymentStatus: PaymentState
}

/**
 * Sent to the buyer when an order transitions to our `Rejected` stage,
 * whether via admin action or Prodigi-side cancellation. Copy adapts to
 * the current Stripe payment state so we never promise money that isn't
 * actually moving.
 */
export async function sendOrderCancelledEmail(
  args: OrderCancelledArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeBuyerName = escapeHtml(args.buyerName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const safeArtist = escapeHtml(args.artistName)
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))

  // What do we tell the buyer about the money?
  const moneyLine =
    args.paymentStatus === 'refunded'
      ? 'Your refund has already been issued and should appear on your statement within 5&ndash;10 business days.'
      : args.paymentStatus === 'succeeded'
        ? 'Your card was charged for this order &mdash; we&rsquo;re processing a full refund now. You&rsquo;ll get another email from us once it&rsquo;s issued; it typically appears on your statement within 5&ndash;10 business days.'
        : args.paymentStatus === 'authorized'
          ? 'The temporary hold we placed on your card will be released shortly &mdash; no money was charged.'
          : args.paymentStatus === 'canceled'
            ? 'The temporary hold on your card has been released &mdash; no money was charged.'
            : 'Our team will be in touch shortly about any money owed to you.'

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Your order has been cancelled',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your order has been cancelled</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeBuyerName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            We&rsquo;re writing to let you know that your order has been cancelled and will not be
            printed or shipped. We&rsquo;re sorry for the inconvenience.
          </p>

          <p style="margin: 0 0 24px 0; line-height: 1.55;">
            ${moneyLine}
          </p>

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 8px 0;"><strong>Order</strong> #${safeOrderId}</p>
            <p style="margin:0;">${safeArtwork} &mdash; ${safeArtist}</p>
          </div>

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            If you have any questions or this was unexpected, just reply to this email and
            we&rsquo;ll get straight back to you.
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
