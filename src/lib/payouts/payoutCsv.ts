/**
 * Pure CSV builder for the /admin/payouts export (payouts.md, plan Decision 8).
 * The page builds it in the browser from the rows it already holds, filtered
 * as on screen, so the file always matches the cards and the totals row.
 *
 * Same rules as the invoice register (src/lib/csv.ts): RFC 4180, CRLF line
 * endings, and formula neutralization for text an artist typed (their name,
 * email and artwork titles).
 */

import { csvField, csvTextField } from '@/lib/csv'
import { formatOrderRef } from '@/lib/orders/orderRef'

import type { AdminPayoutRow } from '@/app/admin/orders/actions'

const HEADERS = [
  'Date paid',
  'Artist',
  'Artist email',
  'Artwork',
  'Source',
  'Method',
  'Transfer ID',
  'Amount',
  'Currency',
  'Order',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD in the viewer's time zone: the same calendar day the table shows. */
function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function payoutsToCsv(rows: AdminPayoutRow[]): string {
  const lines: string[] = [HEADERS.map(csvField).join(',')]

  for (const row of rows) {
    lines.push(
      [
        csvField(localDate(row.paidOutAt)),
        csvTextField(row.artistName),
        csvTextField(row.artistEmail),
        csvTextField(row.artworkTitle),
        csvField(row.source === 'item' ? 'Cart line' : 'Order'),
        csvField(row.transferId ? 'Stripe' : 'Manual'),
        csvField(row.transferId ?? ''),
        csvField((row.amountCents / 100).toFixed(2)), // e.g. 65000 → "650.00"
        csvField(row.currency.toUpperCase()),
        csvField(formatOrderRef(row.orderId)), // the reference shown on screen
      ].join(','),
    )
  }

  return lines.join('\r\n')
}

/** "Beatriz Salvatierra" → "beatriz-salvatierra"; accents dropped, never empty. */
function fileSlug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'artist'
  )
}

/**
 * AR-payouts-{year|all}[-{artist}].csv, e.g. "AR-payouts-2026.csv",
 * "AR-payouts-all-beatriz-salvatierra.csv". `year` null = all years; `artist`
 * is the selected artist's name, or null for all artists.
 */
export function payoutsCsvFilename(year: number | null, artist: string | null): string {
  const scope = year == null ? 'all' : String(year)
  return `AR-payouts-${scope}${artist ? `-${fileSlug(artist)}` : ''}.csv`
}
