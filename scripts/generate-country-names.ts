/**
 * One-time generator for the COUNTRY_NAMES map in
 * src/lib/print-providers/dialCodes.ts.
 *
 * Reads the existing DIAL_CODES keys, resolves each ISO code to an
 * English country name via Node's Intl.DisplayNames (frozen at the
 * Node version used to run this script), and writes the result back
 * into dialCodes.ts as a static `COUNTRY_NAMES` export.
 *
 * Why a script: hard-coding ~250 country-name strings by hand is
 * error-prone and includes politically-sensitive territories. By
 * generating the map once and committing the output, we ship the
 * exact same strings on SSR and CSR (no hydration mismatch from
 * Node-vs-Chrome ICU divergence) without the names ever needing to
 * be typed in source review.
 *
 * Run with: npx tsx scripts/generate-country-names.ts
 * Then delete this file (or keep it to refresh names later).
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const TARGET = join(process.cwd(), 'src/lib/print-providers/dialCodes.ts')

const source = readFileSync(TARGET, 'utf8')

const dialBlockMatch = source.match(/export const DIAL_CODES[^{]*\{([\s\S]*?)\n\}/)
if (!dialBlockMatch) {
  throw new Error('Could not locate DIAL_CODES block in dialCodes.ts')
}
const isoCodes = Array.from(dialBlockMatch[1].matchAll(/^\s*([A-Z]{2}):/gm)).map((m) => m[1])

if (isoCodes.length === 0) {
  throw new Error('Parsed zero ISO codes — aborting')
}

const display = new Intl.DisplayNames(['en'], { type: 'region' })

const lines = isoCodes.map((iso) => {
  const name = display.of(iso) ?? iso
  return `  ${iso}: ${JSON.stringify(name)},`
})

const generated =
  `export const COUNTRY_NAMES: Record<string, string> = {\n` + lines.join('\n') + `\n}\n`

const MARKER_START = '// <COUNTRY_NAMES:start>'
const MARKER_END = '// <COUNTRY_NAMES:end>'

let next: string
if (source.includes(MARKER_START)) {
  next = source.replace(
    new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`),
    `${MARKER_START}\n${generated}${MARKER_END}`,
  )
} else {
  const insertion = `\n${MARKER_START}\n${generated}${MARKER_END}\n`
  next = source.replace(/(export function getDialCode)/, `${insertion}\n$1`)
}

writeFileSync(TARGET, next, 'utf8')
console.log(`Wrote COUNTRY_NAMES (${isoCodes.length} entries) to ${TARGET}`)
