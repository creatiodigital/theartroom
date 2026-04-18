/**
 * Probe Prodigi's sandbox API to see what options exist for a given SKU.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/probe-prodigi.ts [sku]
 *
 * Examples:
 *   npx dotenv -e .env.local -- npx tsx scripts/probe-prodigi.ts GLOBAL-FAP-16X20
 *   npx dotenv -e .env.local -- npx tsx scripts/probe-prodigi.ts GLOBAL-CFP-16X20
 *   npx dotenv -e .env.local -- npx tsx scripts/probe-prodigi.ts GLOBAL-CFPM-16X20
 *
 * SKU families worth inspecting:
 *   GLOBAL-FAP-*   — Fine art print (unframed, giclée)
 *   GLOBAL-CFP-*   — Classic framed print (no mount)
 *   GLOBAL-CFPM-*  — Classic framed print with mount
 */
import { getProduct, createQuote } from '../src/lib/prodigi/client'

const DEFAULT_SKU = 'GLOBAL-CFPM-16X20'

async function main() {
  const sku = process.argv[2] ?? DEFAULT_SKU
  console.log(`\n── Fetching product: ${sku} ──\n`)

  const res = await getProduct(sku)
  console.log('outcome:', res.outcome)
  if (!res.product) {
    console.log('no product returned. Full response:')
    console.log(JSON.stringify(res, null, 2))
    return
  }
  const p = res.product
  console.log('description:', p.description)
  console.log('dimensions:', p.productDimensions)
  console.log('\n── Attributes (raw) ──')
  console.log(JSON.stringify(p.attributes, null, 2))
  console.log('\n── Print areas (raw) ──')
  console.log(JSON.stringify(p.printAreas, null, 2))
  console.log(`\n── Variants: ${(p.variants ?? []).length} total (first 3 raw) ──`)
  console.log(JSON.stringify((p.variants ?? []).slice(0, 3), null, 2))

  console.log('\n── Sample quote (1 copy, ship to GB, Standard) ──')
  // Pick the first available value for every attribute — many SKUs require
  // us to pin the variant (e.g. color must be specified for framed prints).
  const attributes: Record<string, string> = {}
  for (const [name, values] of Object.entries(p.attributes)) {
    if (values[0]) attributes[name] = values[0]
  }
  console.log('  using attributes:', JSON.stringify(attributes))

  try {
    const quote = await createQuote({
      shippingMethod: 'Standard',
      destinationCountryCode: 'GB',
      items: [
        {
          sku,
          copies: 1,
          attributes,
          assets: Object.keys(p.printAreas).map((pa) => ({ printArea: pa })),
        },
      ],
    })
    const q = quote.quotes?.[0]
    if (q) {
      console.log('  item cost:  ', q.costSummary.items.amount, q.costSummary.items.currency)
      console.log('  shipping:   ', q.costSummary.shipping.amount, q.costSummary.shipping.currency)
      console.log('  tax:        ', q.costSummary.totalTax.amount, q.costSummary.totalTax.currency)
      console.log(
        '  total:      ',
        q.costSummary.totalCost.amount,
        q.costSummary.totalCost.currency,
      )
    } else {
      console.log('  no quote returned:', JSON.stringify(quote, null, 2))
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'body' in err) {
      console.log('  quote failed — response body:')
      console.log(JSON.stringify((err as { body: unknown }).body, null, 2))
    } else {
      console.log('  quote failed:', err instanceof Error ? err.message : err)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
