/**
 * THE writer of every size a visitor sees (docs/public-redesign/units.md).
 *
 * - One decimal, always — 40.0, 24.2, 7.9 — in either unit (the rule `formatCm` set for cm).
 * - Height first, "×", the unit once at the end: "22.2 × 33.3 cm", "8.7 × 13.1 in".
 * - A static size shows both, cm first: "22.2 × 33.3 cm | 8.7 × 13.1 in" (owner, 2026-11-17, as
 *   White Cube). Only the print configurator, where sizes are typed and dragged, has a cm | in
 *   switch and writes one unit.
 * - Inches are cm ÷ 2.54, rounded to 0.1. Only the display converts: everything stored or sent
 *   to the server or the print lab stays in cm.
 */

export type Unit = 'cm' | 'in'

export const CM_PER_INCH = 2.54

export type Dimensions = { widthCm: number; heightCm: number }

/** A length in the given unit, rounded to 0.1. */
export function toUnit(cm: number, unit: Unit): number {
  const value = unit === 'in' ? cm / CM_PER_INCH : cm
  return Math.round(value * 10) / 10
}

const write = (cm: number, unit: Unit) => toUnit(cm, unit).toFixed(1)

/** Two lengths as they read on the page — `first × second unit` — in the order given. */
const writePair = (firstCm: number, secondCm: number, unit: Unit) =>
  `${write(firstCm, unit)} × ${write(secondCm, unit)} ${unit}`

/** "5.0 cm" / "2.0 in". */
export function formatSize(cm: number, unit: Unit): string {
  return `${write(cm, unit)} ${unit}`
}

/** "30.0 × 20.0 cm": height first. Takes width, then height, like the data does. */
export function formatDimensions(widthCm: number, heightCm: number, unit: Unit): string {
  return writePair(heightCm, widthCm, unit)
}

/** "30.0 × 20.0 cm to 165.8 × 110.5 cm". */
export function formatDimensionsRange(min: Dimensions, max: Dimensions, unit: Unit): string {
  return `${formatDimensions(min.widthCm, min.heightCm, unit)} to ${formatDimensions(max.widthCm, max.heightCm, unit)}`
}

/** A static size, both units, cm first: "30.0 × 20.0 cm | 11.8 × 7.9 in". */
export function formatDimensionsBoth(widthCm: number, heightCm: number): string {
  return `${formatDimensions(widthCm, heightCm, 'cm')} | ${formatDimensions(widthCm, heightCm, 'in')}`
}

// "30 × 20 cm" or "4.0 cm", the shapes our own formatters have ever written into a cart line or
// an order's specs (whole numbers before the one-decimal rule; full precision on a derived size).
const CM_TEXT = /(\d+(?:\.\d+)?)(?: × (\d+(?:\.\d+)?))? cm\b/g

/**
 * Rewrite every cm length in a line of text that one of our formatters wrote — a cart line's or an
 * order's spec value, stored as text in cm. `'cm'` only normalizes it to one decimal; `'in'`
 * converts; `'both'` writes "<cm> | <in>". Text with no "<number> cm" in it is returned as it was.
 */
export function convertCmText(text: string, to: Unit | 'both'): string {
  return text.replace(CM_TEXT, (_match, first: string, second: string | undefined) => {
    const a = Number(first)
    const b = second === undefined ? null : Number(second)
    const inUnit = (unit: Unit) => (b === null ? formatSize(a, unit) : writePair(a, b, unit))
    return to === 'both' ? `${inUnit('cm')} | ${inUnit('in')}` : inUnit(to)
  })
}

/**
 * A length typed into a size field, read in the visitor's unit ("12", "12,5"), returned in cm on
 * the 0.1 cm grid every stored size uses. Null when it is not a positive number.
 */
export function parseLengthInput(raw: string, unit: Unit): number | null {
  const value = Number(raw.trim().replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  const cm = unit === 'in' ? value * CM_PER_INCH : value
  return Math.round(cm * 10) / 10
}
