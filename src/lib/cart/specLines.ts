import type { SpecsSummary } from '@/lib/print-providers'

type SpecRow = SpecsSummary[number]

/**
 * A cart line's choices as a few short lines (docs/public-redesign/order-flow.md "Cart",
 * designs/cart.dc.html and checkout-2-review.dc.html), built from the line's specs snapshot:
 *
 *   "Giclée on Hahnemühle German Etching"
 *   "25 × 20 cm print · 4 cm border · sheet 33 × 28 cm"
 *   "Print only, no frame"
 *
 * Rows it knows by catalog id get the drawn phrasing. Every other row is still listed, in
 * catalog order, as its own "Label: value" line, so no choice ever drops out of what the
 * buyer sees (the snapshot is what checkout, the email, the admin order and the invoice show).
 */
export function specLines(specs: SpecsSummary): string[] {
  const rows = specs.filter((row) => row.value.trim() !== '')
  const used = new Set<SpecRow>()
  const take = (id: string): string | null => {
    const row = rows.find((r) => r.id === id && !used.has(r))
    if (!row) return null
    used.add(row)
    return row.value
  }

  const lines: string[] = []

  // What it is: "Giclée on Hahnemühle German Etching".
  const printType = take('printType')
  const paper = take('paper')
  const material = printType && paper ? `${printType} on ${paper}` : (printType ?? paper)
  if (material) lines.push(material)

  // How big: "25 × 20 cm print · 4 cm border · sheet 33 × 28 cm".
  const size = take('size')
  const border = take('border')
  const sheet = take('sheet')
  const measures = [
    size && `${size} print`,
    border && borderPhrase(border),
    sheet && `sheet ${sheet}`,
  ].filter((part): part is string => Boolean(part))
  if (measures.length > 0) lines.push(measures.join(' · '))

  // How it is presented: "Print only, no frame", or the frame and its moulding.
  const format = take('format')
  const frameType = take('frameType')
  const moulding = take('moulding')
  if (format && /^print only$/i.test(format)) {
    lines.push('Print only, no frame')
  } else {
    const frame = [frameType, moulding].filter((part): part is string => Boolean(part))
    if (frame.length > 0) lines.push(frame.join(', '))
    else if (format) lines.push(format)
  }

  // The mount with its size: "Mount (Passepartout): Off White, Small (≈ 5 cm)".
  const mountRow = rows.find((r) => r.id === 'windowMount' && !used.has(r))
  const mountSize = mountRow ? take('windowMountSize') : null

  // Everything else (glass, mount, hanging, any row a catalog adds later), one short line each,
  // never dropped.
  for (const row of rows) {
    if (used.has(row)) continue
    used.add(row)
    const value = row === mountRow && mountSize ? `${row.value}, ${mountSize}` : row.value
    lines.push(`${row.label}: ${value}`)
  }

  return lines
}

/** "4 cm border"; "no border" for the summary's "—"; unequal borders keep their wording. */
function borderPhrase(value: string): string {
  if (value === '—') return 'no border'
  if (value.includes(' and ')) return `border ${value}`
  return `${value} border`
}
