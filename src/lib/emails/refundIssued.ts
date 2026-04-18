import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}

type RefundIssuedArgs = {
  to: string
  buyerName: string
  orderId: string
  amountCents: number
  currency: string
}

/**
 * Sent to the buyer when a refund is issued. Deliberately short and
 * apologetic — no mention of the vendor side, no justification required.
 * We're the face of the transaction.
 */
export async function sendRefundIssuedEmail(
  args: RefundIssuedArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeName = escapeHtml(args.buyerName || 'there')
  const safeOrderId = escapeHtml(args.orderId.slice(0, 8))
  const amount = formatAmount(args.amountCents, args.currency)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Your refund from The Art Room',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">Your refund has been issued</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            We&rsquo;ve issued a refund for your order <strong>#${safeOrderId}</strong>.
            The amount of <strong>${amount}</strong> will be returned to the card you used for the
            original purchase.
          </p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Depending on your bank, it may take <strong>5&ndash;10 business days</strong> to appear
            on your statement.
          </p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            We&rsquo;re sorry this order didn&rsquo;t work out. Thank you for giving us the chance,
            and please don&rsquo;t hesitate to reach out if there&rsquo;s anything else we can help
            with.
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
