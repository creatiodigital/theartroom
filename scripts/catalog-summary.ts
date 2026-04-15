/**
 * Build a price summary matrix for Prodigi's Classic Frame + fine-art papers.
 * Probes existence + quotes cost to a destination country in one pass.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/catalog-summary.ts [countryCode]
 *
 * Defaults to ES (Spain). Uses production URL.
 */
import { configureProdigi, createQuote, getProduct } from '../src/lib/prodigi/client'
import type { ProdigiProduct } from '../src/lib/prodigi/types'

configureProdigi({ baseUrl: 'https://api.prodigi.com/v4.0' })

const country = process.argv[2] ?? 'ES'

// Common Prodigi sizes (cm).
const SIZES = [
  '20X25', // 8x10"
  '20X30', // 8x12"
  '28X36', // 11x14"
  '30X40', // 12x16"
  '40X50', // 16x20"
  '46X61', // 18x24"
  '50X70', // ~20x28"
  '60X80', // 24x32"
] as const

type Tier = { label: string; unframedSku?: string; framedNoMount?: string; framedMount?: string }

function sku(family: 'U' | 'FNM' | 'FM', tier: Tier, size: string): string | undefined {
  if (family === 'U' && tier.unframedSku) return `${tier.unframedSku}-${size}`
  if (family === 'FNM' && tier.framedNoMount) return `FRA-CLA-${tier.framedNoMount}-NM-ACRY-${size}`
  if (family === 'FM' && tier.framedMount) return `FRA-CLA-${tier.framedMount}-MOUNT1-ACRY-${size}`
  return undefined
}

// Tiers with their SKU tokens.
const TIERS: Tier[] = [
  {
    label: 'Budget (BAP 180gsm)',
    unframedSku: 'GLOBAL-BLP', // closest unframed equivalent
    framedNoMount: 'BAP',
    framedMount: 'BAP',
  },
  {
    label: 'Standard (EMA 200gsm)',
    unframedSku: 'GLOBAL-FAP', // EMA-backed
    // EMA framed lives in the older GLOBAL-CFP-* family, not FRA-CLA-*
  },
  {
    label: 'Premium (Photo Rag 308gsm)',
    unframedSku: 'GLOBAL-HPR',
    framedNoMount: 'HPR',
    framedMount: 'HPR',
  },
  {
    label: 'Premium Textured (German Etching 310gsm)',
    unframedSku: 'GLOBAL-HGE',
    framedNoMount: 'HGE',
    framedMount: 'HGE',
  },
]

type Row = {
  tier: string
  format: string
  size: string
  sku: string
  item: number
  shipping: number
  tax: number
  total: number
  currency: string
}

async function probeAndQuote(sku: string): Promise<Omit<Row, 'tier' | 'format' | 'size'> | null> {
  let product: ProdigiProduct
  try {
    product = (await getProduct(sku)).product
  } catch {
    return null
  }
  const attrs: Record<string, string> = {}
  for (const [n, v] of Object.entries(product.attributes)) {
    if (v[0]) attrs[n] = v[0]
  }
  try {
    const res = await createQuote({
      shippingMethod: 'Standard',
      destinationCountryCode: country,
      items: [
        {
          sku,
          copies: 1,
          attributes: attrs,
          assets: Object.keys(product.printAreas).map((pa) => ({ printArea: pa })),
        },
      ],
    })
    const q = res.quotes?.[0]
    if (!q) return null
    return {
      sku,
      item: Number(q.costSummary.items.amount),
      shipping: Number(q.costSummary.shipping.amount),
      tax: Number(q.costSummary.totalTax.amount),
      total: Number(q.costSummary.totalCost.amount),
      currency: q.costSummary.totalCost.currency,
    }
  } catch {
    return null
  }
}

async function main() {
  console.log(`\nProdigi catalog summary → shipping to ${country}\n`)

  const rows: Row[] = []
  const tasks: Array<{ tier: string; format: string; size: string; sku: string }> = []

  for (const tier of TIERS) {
    for (const size of SIZES) {
      const unframed = sku('U', tier, size)
      const fnm = sku('FNM', tier, size)
      const fm = sku('FM', tier, size)
      if (unframed) tasks.push({ tier: tier.label, format: 'Unframed', size, sku: unframed })
      if (fnm) tasks.push({ tier: tier.label, format: 'Framed', size, sku: fnm })
      if (fm) tasks.push({ tier: tier.label, format: 'Framed + Mount', size, sku: fm })
    }
  }

  console.log(`Probing ${tasks.length} SKUs...\n`)

  // Batch to avoid hammering Prodigi.
  const batchSize = 4
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize)
    const results = await Promise.all(batch.map((t) => probeAndQuote(t.sku)))
    results.forEach((r, idx) => {
      if (r) {
        rows.push({ tier: batch[idx].tier, format: batch[idx].format, size: batch[idx].size, ...r })
      }
    })
    process.stdout.write(`  ${Math.min(i + batchSize, tasks.length)}/${tasks.length}\r`)
  }
  process.stdout.write('\n\n')

  // Group by tier → format.
  for (const tier of TIERS) {
    console.log(`── ${tier.label} ──`)
    const byFormat = new Map<string, Row[]>()
    for (const r of rows.filter((r) => r.tier === tier.label)) {
      if (!byFormat.has(r.format)) byFormat.set(r.format, [])
      byFormat.get(r.format)!.push(r)
    }
    for (const [format, list] of byFormat) {
      console.log(`  ${format}`)
      console.log(
        `    ${'size'.padEnd(8)} ${'item'.padStart(7)}  ${'ship'.padStart(7)}  ${'tax'.padStart(6)}  ${'total'.padStart(8)}`,
      )
      for (const r of list) {
        const sizeCm = r.size.replace('X', '×') + 'cm'
        console.log(
          `    ${sizeCm.padEnd(8)} €${r.item.toFixed(2).padStart(6)}  €${r.shipping.toFixed(2).padStart(6)}  €${r.tax.toFixed(2).padStart(5)}  €${r.total.toFixed(2).padStart(7)}`,
        )
      }
    }
    console.log()
  }

  console.log(`Total resolved SKUs: ${rows.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
