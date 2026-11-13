/**
 * CSV field helpers shared by the admin's CSV exports (the invoice register,
 * the payouts export). Pure, so the builders stay unit-testable.
 *
 * Follows RFC 4180: fields containing commas, double-quotes, or newlines
 * are wrapped in double-quotes, and any embedded double-quotes are escaped
 * by doubling them ("").
 *
 * Text a buyer or an artist typed additionally gets spreadsheet-formula
 * neutralization (csvTextField): a cell starting with = + - @ (or tab/CR)
 * executes as a formula when the file is opened in Excel/Sheets.
 */

/** Escape a single CSV field value per RFC 4180. */
export function csvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** RFC 4180 escaping + formula neutralization for buyer-controlled text. */
export function csvTextField(value: string | null | undefined): string {
  const s = value == null ? '' : String(value)
  const looksLikeFormula = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)
  return csvField(looksLikeFormula ? `'${s}` : s)
}
