import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailNotice,
} from './components'
import { renderEmailLayout } from './layout'
import { ADMIN_EMAIL_TO } from './recipients'

const resend = new Resend(process.env.RESEND_API_KEY)

/** Fixed: no visitor text ever reaches a header (feedback.md "Email"). */
export const FEEDBACK_EMAIL_SUBJECT = 'New visitor feedback'

export type FeedbackAdminNotificationArgs = {
  /** Sanitized, not escaped: the renderer escapes it (visitor text, hostile by definition). */
  message: string
  /** "Home page", or the exhibition's title as the database has it. */
  from: string
  sentAt: Date
}

const madridTime = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)

/**
 * Pure renderer for the owner's copy of a visitor's feedback (docs/public-redesign/feedback.md):
 * the message (escaped, line breaks kept), where it came from and when (Europe/Madrid), as HTML
 * and as plain text. No side effects; safe to call from tests.
 */
export function renderFeedbackAdminNotificationEmail(args: FeedbackAdminNotificationArgs): {
  subject: string
  html: string
  text: string
} {
  const when = madridTime(args.sentAt)
  const body =
    emailHeading('New visitor feedback') +
    emailDetailRows([
      { label: 'From', value: escapeHtml(args.from) },
      { label: 'Sent', value: escapeHtml(when) },
    ]) +
    emailDivider() +
    emailEyebrow('Message') +
    emailNotice('info', escapeHtml(args.message).replace(/\n/g, '<br>'))

  return {
    subject: FEEDBACK_EMAIL_SUBJECT,
    html: renderEmailLayout({ preheader: `Visitor feedback from ${args.from}`, bodyHtml: body }),
    text: `New visitor feedback\n\nFrom: ${args.from}\nSent: ${when}\n\n${args.message}\n`,
  }
}

/**
 * Sends it to the gallery (ADMIN_EMAIL_TO; no CC and no reply-to, as the inquiry notification has
 * none and the sender is anonymous). Resolves `{ ok: false }` on failure rather than throwing.
 */
export async function sendFeedbackAdminNotificationEmail(
  args: FeedbackAdminNotificationArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (process.env.SKIP_EMAILS === 'true') {
    return { ok: true, id: 'skipped-e2e' }
  }

  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  const { subject, html, text } = renderFeedbackAdminNotificationEmail(args)

  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to: ADMIN_EMAIL_TO,
      subject,
      html,
      text,
    })
    if (res.error) return { ok: false, error: res.error.message ?? 'resend error' }
    return { ok: true, id: res.data?.id ?? '' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
