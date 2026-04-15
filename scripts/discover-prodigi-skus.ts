/**
 * Probe a batch of candidate Prodigi SKUs to discover which combinations
 * actually exist.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/discover-prodigi-skus.ts
 *
 * The FRA-CLA-* family uses position-based tokens:
 *   FRA-<FRAME>-<PAPER>-<MOUNT>-<GLAZE>-<SIZE_CM>
 *
 * Example confirmed by Prodigi support:
 *   FRA-CLA-HPR-NM-ACRY-40X50   (Classic / Photo Rag / No Mount / Perspex / 16x20")
 */
import { configureProdigi, getProduct } from '../src/lib/prodigi/client'

const discoveryUrl = process.env.PRODIGI_DISCOVERY_URL ?? 'https://api.prodigi.com/v4.0'
const discoveryKey = process.env.PRODIGI_DISCOVERY_KEY
configureProdigi({
  baseUrl: discoveryUrl,
  ...(discoveryKey ? { apiKey: discoveryKey } : {}),
})
console.log(`Discovery target: ${discoveryUrl}`)
console.log()

// Token vocabularies — overlapping guesses, the probe will tell us which
// resolve. Confirmed so far: NM, MOUNT1 (1.4mm), ACRY (Perspex), GLA (Float).
const FRAMES = ['CLA'] as const
const PAPERS = ['HPR', 'HGE', 'BAP', 'CPWP', 'LPP'] as const
const MOUNTS = ['NM', 'MOUNT1', 'MOUNT2'] as const
const GLAZES = [
  'ACRY', // Perspex (confirmed)
  'GLA', // Float glass (confirmed)
  'MEGLA',
  'MEG',
  'MEYE',
  'ME',
  'MOTH',
  'MOTHEYE',
  'ANTI',
  'AR',
  'ARGLA',
  'NORE',
  'NOGLARE',
  'NGLARE',
  'ANTIREFLECT',
] as const
const SIZE_CM = '30X40' // 12x16" — matches the known MOUNT1 SKU

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

function buildCandidates(): string[] {
  const c: string[] = []

  // Known-good baselines
  c.push('FRA-CLA-HPR-NM-ACRY-40X50')
  c.push('FRA-CLA-HPR-MOUNT1-GLA-30X40')

  // Full matrix within the FRA-CLA-* family
  for (const frame of FRAMES) {
    for (const paper of PAPERS) {
      for (const mount of MOUNTS) {
        for (const glaze of GLAZES) {
          c.push(`FRA-${frame}-${paper}-${mount}-${glaze}-${SIZE_CM}`)
        }
      }
    }
  }

  return uniq(c)
}

type ProbeResult = {
  sku: string
  status: 'hit' | 'miss' | 'error'
  description?: string
  variants?: number
  error?: string
}

async function probe(sku: string): Promise<ProbeResult> {
  try {
    const res = await getProduct(sku)
    return {
      sku,
      status: 'hit',
      description: res.product.description,
      variants: res.product.variants?.length ?? 0,
    }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      (err as { status: number }).status === 404
    ) {
      return { sku, status: 'miss' }
    }
    return {
      sku,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const out = await Promise.all(batch.map(worker))
    results.push(...out)
    process.stdout.write(`  probed ${Math.min(i + batchSize, items.length)}/${items.length}\r`)
  }
  process.stdout.write('\n')
  return results
}

async function main() {
  const candidates = buildCandidates()
  console.log(`Probing ${candidates.length} candidate SKUs...\n`)

  const results = await runInBatches(candidates, 4, probe)

  const hits = results.filter((r) => r.status === 'hit')
  const errors = results.filter((r) => r.status === 'error')

  console.log(`\n── Hits (${hits.length}) ──`)
  for (const h of hits) {
    console.log(
      `  ✓ ${h.sku.padEnd(36)} variants:${String(h.variants).padStart(3)}  ${h.description}`,
    )
  }

  if (errors.length > 0) {
    console.log(`\n── Errors (${errors.length}) ──`)
    for (const e of errors) {
      console.log(`  ✗ ${e.sku}  ${e.error}`)
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`  hits:   ${hits.length}`)
  console.log(`  misses: ${results.filter((r) => r.status === 'miss').length}`)
  console.log(`  errors: ${errors.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
