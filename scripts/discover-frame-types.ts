/**
 * Probe Prodigi for frame-style tokens beyond Classic (CLA).
 * Run: npx dotenv -e .env.local -- npx tsx scripts/discover-frame-types.ts
 */
import { configureProdigi, getProduct } from '../src/lib/prodigi/client'

configureProdigi({ baseUrl: 'https://api.prodigi.com/v4.0' })

// Frame-style guesses. CLA is confirmed Classic. Try common framing styles.
const FRAME_STYLES = [
  'CLA', // Classic (confirmed)
  'GAL', // Gallery
  'BOX', // Box
  'FLO', // Floating
  'FLT', // Float
  'TRA', // Tray
  'MOD', // Modern
  'LEG', // Legacy
  'MET', // Metal
  'CAN', // Canvas-wrap (different product but related)
  'GCL', // Gallery classic
  'WOO', // Wood
  'THI', // Thin
  'WID', // Wide
  'SIM', // Simple
  'MUS', // Museum
] as const

// Use the confirmed known-good paper/mount/glaze/size.
const SIZE = '40X50'
const PAPER = 'HPR'
const MOUNT = 'NM'
const GLAZE = 'ACRY'

async function probe(sku: string) {
  try {
    const res = await getProduct(sku)
    return { sku, ok: true as const, description: res.product.description }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'status' in err &&
      (err as { status: number }).status === 404
    ) {
      return { sku, ok: false as const }
    }
    return { sku, ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

async function main() {
  const skus = FRAME_STYLES.map((f) => `FRA-${f}-${PAPER}-${MOUNT}-${GLAZE}-${SIZE}`)
  const results = await Promise.all(skus.map(probe))
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✓ ${r.sku.padEnd(30)}  ${r.description}`)
    }
  }
  const hits = results.filter((r) => r.ok).length
  console.log(`\n${hits}/${results.length} frame styles resolved.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
