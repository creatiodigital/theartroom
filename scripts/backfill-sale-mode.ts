/**
 * One-shot backfill for docs/unique-sales U1.
 *
 * `Artwork.saleMode` defaults to "none" (not for sale), which Postgres gives every existing row
 * when the column is added. The works that sell prints today (`printEnabled` true) must read
 * "prints", so `saleMode` and `printEnabled` agree from the start; from then on the artwork save
 * keeps them in step (src/lib/artwork/saleMode.ts). Nothing else changes: the print pipeline
 * still reads `printEnabled`.
 *
 * Idempotent: re-running it changes nothing. Run once per database, after the schema push.
 *
 * Env vars (POSTGRES_PRISMA_URL) must be injected before the process starts — @/lib/prisma reads
 * it at import time. Same wrapper as scripts/backfill-space-published.ts:
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-sale-mode.ts          # dry run
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-sale-mode.ts --apply  # write
 */

import prisma from '@/lib/prisma'

async function main() {
  const apply = process.argv.includes('--apply')
  const where = { printEnabled: true, saleMode: { not: 'prints' } }

  const candidates = await prisma.artwork.findMany({
    where,
    select: { slug: true, title: true, saleMode: true },
    orderBy: { createdAt: 'asc' },
  })

  if (candidates.length === 0) {
    console.log('Nothing to do — every work that sells prints already reads saleMode "prints".')
    return
  }

  console.log(`${candidates.length} work(s) selling prints, saleMode not "prints" yet:`)
  for (const artwork of candidates) {
    console.log(`  ${artwork.slug}  (${artwork.saleMode})  ${artwork.title}`)
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to set them to "prints".')
    return
  }

  const { count } = await prisma.artwork.updateMany({ where, data: { saleMode: 'prints' } })
  console.log(`\nSet ${count} work(s) to saleMode "prints".`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
