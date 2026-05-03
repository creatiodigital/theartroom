import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

function formatAmount(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase() + ' '
  return `${symbol}${(cents / 100).toFixed(2)}`
}

type ArtistPayoutArgs = {
  to: string
  artistFirstName: string
  artworkTitle: string
  amountCents: number
  currency: string
  transferId: string
}

/**
 * Sent to the artist when we release their payout — which is intentionally
 * the *only* moment they hear from us about a sale. We hold off through the
 * order/production/shipping/delivery window so the message is a real
 * confirmation, never a promise that might not land.
 */
export async function sendArtistPayoutEmail(
  args: ArtistPayoutArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeName = escapeHtml(args.artistFirstName || 'there')
  const safeArtwork = escapeHtml(args.artworkTitle)
  const amount = formatAmount(args.amountCents, args.currency)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: args.to,
      subject: 'Someone bought your print — we’ve sent your share',
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0;">You made a sale</h2>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">Hi ${safeName},</p>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            Someone bought a print of your work <strong>${safeArtwork}</strong>. The order has been
            produced, shipped and accepted &mdash; so we&rsquo;ve just released your share.
          </p>

          <div style="background:#f6f6f6; padding:16px 20px; margin: 0 0 24px 0;">
            <p style="margin:0 0 6px 0;"><strong>Your share</strong></p>
            <p style="margin:0; font-size: 20px;">${amount}</p>
          </div>

          <p style="margin: 0 0 16px 0; line-height: 1.55;">
            The money is on its way to your connected Stripe account. Stripe will pay it out to your
            bank on your usual payout schedule &mdash; you can check the status any time from your
            Stripe dashboard.
          </p>

          <p style="margin: 0 0 8px 0; line-height: 1.55;">
            Thanks for having your work on The Art Room.
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
