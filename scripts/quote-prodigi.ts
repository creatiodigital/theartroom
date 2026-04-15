/**
 * Get a real Prodigi quote for a specific SKU shipped to a specific country.
 * Uses production URL (read-only) so premium framed SKUs resolve.
 *
 * Run:
 *   npx dotenv -e .env.local -- npx tsx scripts/quote-prodigi.ts <sku> [countryCode]
 *
 * Example:
 *   npx dotenv -e .env.local -- npx tsx scripts/quote-prodigi.ts FRA-CLA-LPP-MOUNT1-ACRY-30X40 ES
 */
import { configureProdigi, createQuote, getProduct } from '../src/lib/prodigi/client'

configureProdigi({ baseUrl: 'https://api.prodigi.com/v4.0' })

async function main() {
  const sku = process.argv[2]
  const country = process.argv[3] ?? 'ES'
  if (!sku) {
    console.error('Usage: quote-prodigi.ts <sku> [countryCode]')
    process.exit(1)
  }

  const prod = await getProduct(sku)
  const p = prod.product
  console.log(`\n${p.description}`)

  const attributes: Record<string, string> = {}
  for (const [name, values] of Object.entries(p.attributes)) {
    if (values[0]) attributes[name] = values[0]
  }

  for (const method of ['Budget', 'Standard', 'Express'] as const) {
    try {
      const res = await createQuote({
        shippingMethod: method,
        destinationCountryCode: country,
        items: [
          {
            sku,
            copies: 1,
            attributes,
            assets: Object.keys(p.printAreas).map((pa) => ({ printArea: pa })),
          },
        ],
      })
      const q = res.quotes?.[0]
      if (q) {
        const item = q.costSummary.items
        const ship = q.costSummary.shipping
        const tax = q.costSummary.totalTax
        const total = q.costSummary.totalCost
        console.log(
          `  ${method.padEnd(9)} → item €${item.amount.padStart(6)}  +ship €${ship.amount.padStart(5)}  +tax €${tax.amount.padStart(5)}  = €${total.amount} ${total.currency}`,
        )
      } else {
        console.log(`  ${method.padEnd(9)} → no quote returned`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${method.padEnd(9)} → ${msg}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
