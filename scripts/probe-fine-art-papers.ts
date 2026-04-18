/**
 * Probe Prodigi LIVE for the SKU prefixes of candidate fine-art papers.
 * Read-only (getProduct calls) — no orders created, safe against prod.
 *
 * Run:
 *   PRODIGI_DISCOVERY_URL=https://api.prodigi.com/v4.0 \
 *   PRODIGI_DISCOVERY_KEY=<your-live-key> \
 *     npx tsx scripts/probe-fine-art-papers.ts
 *
 * For each candidate paper we try a small sample of unframed SKUs
 * (one small + one medium size) against the pattern
 *     GLOBAL-<PREFIX>-<INCH_TOKEN>
 * and report which prefixes resolve. Whichever does is the right
 * `prodigiUnframedPrefix` for the PAPERS entry.
 */
import { ProdigiError, configureProdigi, getProduct } from '../src/lib/prodigi/client'

const baseUrl = process.env.PRODIGI_DISCOVERY_URL ?? 'https://api.prodigi.com/v4.0'
const apiKey = process.env.PRODIGI_DISCOVERY_KEY ?? process.env.PRODIGI_API_KEY

if (!apiKey) {
  console.error('No API key. Set PRODIGI_DISCOVERY_KEY or PRODIGI_API_KEY.')
  process.exit(1)
}

configureProdigi({ baseUrl, apiKey })
console.log(`Probing: ${baseUrl}\n`)

// Candidate paper families to try. Each entry is a human name + a set of
// plausible Prodigi SKU prefixes to probe. Whichever prefix resolves is
// the one we'll wire into PAPERS.
const CANDIDATES: Array<{ name: string; prefixes: string[] }> = [
  {
    // Referenced as "BLP" (Budget Lustre Photo?) in existing catalog-summary.ts
    name: 'GLOBAL-BLP (Budget tier from existing code)',
    prefixes: ['GLOBAL-BLP'],
  },
  {
    name: 'Canson Infinity Baryta / Canson Photo',
    prefixes: ['GLOBAL-BAP', 'GLOBAL-CPHP', 'GLOBAL-CPH', 'GLOBAL-LPP'],
  },
  {
    name: 'Hahnemühle Museum Etching 350 gsm',
    prefixes: [
      'GLOBAL-HMU',
      'GLOBAL-HMET',
      'GLOBAL-HMR',
      'GLOBAL-HNM',
      'GLOBAL-HMUS',
      'GLOBAL-HMUE',
    ],
  },
  {
    name: 'Hahnemühle FineArt Baryta 325',
    prefixes: ['GLOBAL-HFAB', 'GLOBAL-HFBA', 'GLOBAL-HFA', 'GLOBAL-HFIN'],
  },
  {
    name: 'Hahnemühle Photo Rag Ultra Smooth / Bright White',
    prefixes: ['GLOBAL-HPRS', 'GLOBAL-HPU', 'GLOBAL-HPBW', 'GLOBAL-HUS'],
  },
]

// Sizes to probe per prefix — just a couple to confirm the family exists.
// If the prefix is right for one small size, it'll resolve for others too
// (availability per country comes later via the normal catalog flow).
const SAMPLE_SIZES = ['8X10', '12X16']

async function probe(sku: string): Promise<{ ok: true } | { ok: false; status?: number }> {
  try {
    await getProduct(sku)
    return { ok: true }
  } catch (err) {
    if (err instanceof ProdigiError) return { ok: false, status: err.status }
    return { ok: false }
  }
}

async function main() {
  for (const candidate of CANDIDATES) {
    console.log(`▸ ${candidate.name}`)
    let resolved: string | null = null
    for (const prefix of candidate.prefixes) {
      let allOk = true
      for (const size of SAMPLE_SIZES) {
        const sku = `${prefix}-${size}`
        const res = await probe(sku)
        if (!res.ok) {
          allOk = false
          break
        }
      }
      if (allOk) {
        resolved = prefix
        break
      }
    }
    if (resolved) {
      console.log(`    ✓ prefix = ${resolved}`)
    } else {
      console.log(`    ✗ no prefix matched; candidates tried: ${candidate.prefixes.join(', ')}`)
    }
    console.log()
  }
}

main().catch((err) => {
  console.error('Probe failed:', err)
  process.exit(1)
})
