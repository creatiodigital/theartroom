import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_TO = 'contact@theartroom.gallery'
const ADMIN_CC = 'contact@creatio.art'

type CriticalAlertArgs = {
  /** Short headline shown in the email subject and big H2. */
  title: string
  /** What broke, in plain English. Include the error message verbatim. */
  problem: string
  /** Stripe PaymentIntent id, when known. Surfaces a deep link to the
   *  Stripe dashboard so the admin can confirm the buyer's auth state. */
  paymentIntentId?: string | null
  /** Free-form key/value context (artwork id, error stack, etc.). */
  context?: Record<string, string | number | null | undefined>
  /** Concrete next steps for the admin to recover. */
  whatToDo: string[]
}

/**
 * Last-resort alert for the gallery admin when the order pipeline fails
 * in a way that could leave a buyer's card authorized with no PrintOrder
 * row to act on (i.e. money held, no admin visibility). Sends to the
 * standard admin alias + cc, with a loud subject line so it sorts to the
 * top of the inbox.
 *
 * Never throws — failures here would create a meta-incident. Returns
 * `{ ok: false }` so the caller can record the email-send failure in the
 * order event log if an order id is available.
 */
export async function sendAdminCriticalAlert(
  args: CriticalAlertArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'

  const safeTitle = escapeHtml(args.title)
  const safeProblem = escapeHtml(args.problem)
  const safePI = args.paymentIntentId ? escapeHtml(args.paymentIntentId) : null

  const stripeUrl = safePI ? `https://dashboard.stripe.com/payments/${safePI}` : null

  const contextRows = args.context
    ? Object.entries(args.context)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:2px 0;font-family:monospace;font-size:12px;word-break:break-all;">${escapeHtml(String(v))}</td></tr>`,
        )
        .join('')
    : ''

  const todoItems = args.whatToDo
    .map((step) => `<li style="margin:0 0 6px 0;">${escapeHtml(step)}</li>`)
    .join('')

  try {
    const res = await resend.emails.send({
      from: `The Art Room Alerts <${fromEmail}>`,
      to: ADMIN_TO,
      cc: ADMIN_CC,
      subject: `🚨 ORDER PIPELINE ALERT — ${args.title}`,
      html: `
        <div style="font-family: Lato, sans-serif; max-width: 640px; margin: 0 auto; color: #111;">
          <div style="padding: 14px 18px; background:#fdecea; border:2px solid #b91c1c; border-radius: 4px; margin-bottom: 20px;">
            <h2 style="font-size: 18px; margin: 0 0 6px 0; color:#7f1d1d;">🚨 ${safeTitle}</h2>
            <p style="margin:0; font-size: 13px; color:#7f1d1d;">A buyer may have paid (or had their card authorized) without a corresponding order row. Investigate immediately.</p>
          </div>

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:0 0 8px 0;">What broke</h3>
          <p style="margin:0 0 16px 0; padding:10px 14px; background:#f6f6f6; border-radius:3px; font-family:monospace; font-size:12px; word-break:break-word;">${safeProblem}</p>

          ${stripeUrl ? `<p style="margin: 0 0 20px 0;"><a href="${stripeUrl}" style="background:#635bff;color:#fff;padding:10px 16px;text-decoration:none;display:inline-block;border-radius:3px;">Open PaymentIntent in Stripe →</a></p>` : ''}

          ${contextRows ? `<h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">Context</h3><table style="border-collapse:collapse;font-size:13px;">${contextRows}</table>` : ''}

          <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#666;margin:24px 0 8px 0;">What to do</h3>
          <ol style="margin:0; padding-left: 20px; font-size: 14px;">${todoItems}</ol>

          <p style="margin: 32px 0 0 0; color:#999; font-size: 11px;">
            Sent by the order-pipeline safety net. If you're seeing this it means the normal admin order email did not fire.
          </p>
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
