import { renderToBuffer } from '@react-pdf/renderer'

import { captureError } from '@/lib/observability/captureError'
import { buildCertificateKey, uploadToR2 } from '@/lib/r2'

import { CertificateTemplate } from './CertificateTemplate'

type Args = {
  orderId: string
  artworkTitle: string
  artistName: string
  /** Transparent-PNG signature URL. Falls back to a signature line only when absent. */
  signatureImageUrl?: string | null
  /** Usually `new Date()` — when the order was placed. */
  purchaseDate: Date
}

/**
 * Render the certificate of authenticity PDF and upload it to R2. Returns
 * the public URL of the stored PDF, which we then hand to Prodigi as a
 * `branding.flyer` asset on the order.
 *
 * The R2 key is deterministic per order (`certificates/{orderId}.pdf`),
 * so a webhook retry that re-renders will overwrite rather than creating
 * duplicate files — and the same URL can be re-fetched at any time.
 */
export async function generateAndUploadCertificate(
  args: Args,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const element = CertificateTemplate({
      artworkTitle: args.artworkTitle || '(untitled)',
      artistName: args.artistName || 'Unknown Artist',
      purchaseDate: args.purchaseDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      signatureImageUrl: args.signatureImageUrl,
    })

    const buffer = await renderToBuffer(element)
    const key = buildCertificateKey(args.orderId)
    const url = await uploadToR2(key, buffer, 'application/pdf')
    return { ok: true, url }
  } catch (err) {
    // Caller (createPrintOrderFromPaymentIntent) also captures this with
    // order context; here we capture at the generation site so operators
    // see which stage failed — PDF render vs R2 upload vs signature
    // fetch — without needing to reproduce.
    captureError(err, {
      flow: 'cert',
      stage: 'render-or-upload',
      extra: { orderId: args.orderId, hasSignature: !!args.signatureImageUrl },
      level: 'warning',
      fingerprint: ['cert:render-or-upload'],
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
