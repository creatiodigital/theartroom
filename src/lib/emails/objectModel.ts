import { Resend } from 'resend'

import { escapeHtml } from '@/utils/escapeHtml'
import {
  emailButton,
  emailDetailRows,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailNotice,
  emailParagraph,
} from './components'
import { renderEmailLayout } from './layout'
import { ADMIN_EMAIL_TO } from './recipients'

const resend = new Resend(process.env.RESEND_API_KEY)

type SendResult = { ok: true; id: string } | { ok: false; error: string }

/**
 * An Object's 3D model (docs/objects O4). Two emails:
 * - to the gallery: an artist asked for a 3D model, or for a change to the ready one (their note,
 *   and the name and size of a file they attached; never the file's address, which only the
 *   editor shows to the team);
 * - to the artist: the model is ready (the editor promises "we will email you when it is ready").
 */
export type ModelRequestAdminArgs = {
  kind: 'model' | 'change'
  artworkTitle: string
  artistName: string
  /** Plain text from the artist (escaped here). */
  note: string | null
  file: { name: string; sizeBytes: number | null } | null
  editUrl: string
}

const megabytes = (bytes: number | null) =>
  bytes === null ? '' : ` · ${(bytes / (1024 * 1024)).toFixed(1)} MB`

export function renderModelRequestAdminEmail(args: ModelRequestAdminArgs) {
  const heading = args.kind === 'model' ? '3D model requested' : 'Change asked for a 3D model'
  const subject = `${heading}: ${args.artworkTitle}`
  const body =
    emailHeading(heading) +
    emailDetailRows([
      { label: 'Object', value: escapeHtml(args.artworkTitle) },
      { label: 'Artist', value: escapeHtml(args.artistName) },
      ...(args.file
        ? [
            {
              label: 'File sent',
              value: `${escapeHtml(args.file.name)}${megabytes(args.file.sizeBytes)}`,
            },
          ]
        : []),
    ]) +
    (args.note
      ? emailDivider() +
        emailEyebrow('Note') +
        emailNotice('info', escapeHtml(args.note).replace(/\n/g, '<br>'))
      : '') +
    emailButton('Open the Object', args.editUrl)

  const text =
    `${heading}\n\nObject: ${args.artworkTitle}\nArtist: ${args.artistName}\n` +
    (args.file ? `File sent: ${args.file.name}${megabytes(args.file.sizeBytes)}\n` : '') +
    (args.note ? `\nNote:\n${args.note}\n` : '') +
    `\nOpen the Object: ${args.editUrl}\n`

  return {
    subject,
    html: renderEmailLayout({ preheader: `${heading} for ${args.artworkTitle}`, bodyHtml: body }),
    text,
  }
}

export type ModelReadyArtistArgs = {
  artistFirstName: string | null
  artworkTitle: string
  editUrl: string
}

export function renderModelReadyArtistEmail(args: ModelReadyArtistArgs) {
  const subject = `Your 3D model is ready: ${args.artworkTitle}`
  const greeting = args.artistFirstName ? `Hello ${args.artistFirstName},` : 'Hello,'
  const body =
    emailHeading('Your 3D model is ready') +
    emailParagraph(escapeHtml(greeting)) +
    emailParagraph(
      `We have prepared the 3D model of <strong>${escapeHtml(args.artworkTitle)}</strong>. You can turn it around in your artwork’s editor, under In the 3D space.`,
    ) +
    emailButton('See it', args.editUrl)
  const text =
    `${greeting}\n\nWe have prepared the 3D model of ${args.artworkTitle}. You can turn it around in ` +
    `your artwork’s editor, under In the 3D space.\n\nSee it: ${args.editUrl}\n`
  return {
    subject,
    html: renderEmailLayout({
      preheader: `The 3D model of ${args.artworkTitle} is ready`,
      bodyHtml: body,
    }),
    text,
  }
}

async function send(
  to: string,
  rendered: { subject: string; html: string; text: string },
): Promise<SendResult> {
  if (process.env.SKIP_EMAILS === 'true') return { ok: true, id: 'skipped-e2e' }
  const fromEmail = process.env.FROM_EMAIL || 'contact@theartroom.gallery'
  try {
    const res = await resend.emails.send({
      from: `The Art Room <${fromEmail}>`,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
    if (res.error) return { ok: false, error: res.error.message }
    return { ok: true, id: res.data?.id ?? 'unknown' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const sendModelRequestAdminEmail = (args: ModelRequestAdminArgs) =>
  send(ADMIN_EMAIL_TO, renderModelRequestAdminEmail(args))

export const sendModelReadyArtistEmail = (to: string, args: ModelReadyArtistArgs) =>
  send(to, renderModelReadyArtistEmail(args))
