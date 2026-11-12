import type { SpecsSummary } from '@/lib/print-providers'

type SpecRow = SpecsSummary[number]

/**
 * A cart line's choices as short lines, one subject each (owner, 2026-11-12: one line packing
 * size, border and sheet was too hard to read), built from the line's specs snapshot:
 *
 *   "Giclée on Hahnemühle German Etching"
 *   "Print size: 25 × 20 cm"
 *   "Border: 4 cm"
 *   "Sheet: 33 × 28 cm"
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

  // How big, one line each: "Print size: 25 × 20 cm", "Border: 4 cm", "Sheet: 33 × 28 cm".
  const size = take('size')
  const border = take('border')
  const sheet = take('sheet')
  if (size) lines.push(`Print size: ${size}`)
  if (border) lines.push(`Border: ${border === '—' ? 'none' : border}`)
  if (sheet) lines.push(`Sheet: ${sheet}`)

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

/**
 * One short line for the checkout's compact item rows (designs/checkout-1-shipping.dc.html: "25 × 20 cm ·
 * print only"): the print size and how it is presented. The full lines are on the review step.
 */
export function specShortLine(specs: SpecsSummary): string {
  const value = (id: string) => specs.find((r) => r.id === id)?.value.trim() || null
  const size = value('size')
  const format = value('format')
  const presentation =
    format && /^print only$/i.test(format) ? 'print only' : (value('frameType') ?? format)
  return [size, presentation].filter(Boolean).join(' · ')
}
