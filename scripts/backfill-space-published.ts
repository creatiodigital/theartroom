/**
 * One-shot backfill for AR-151.
 *
 * `Exhibition.spacePublished` defaults to FALSE so a newly created exhibition
 * is page-first and its 3D room is revealed only when it is ready. Applied
 * naively that default would also darken every room already live in
 * production, because Postgres gives existing rows the column default.
 *
 * So: every exhibition that is currently published gets its room switched on,
 * restoring exactly the behavior visitors see today. Unpublished exhibitions
 * are left alone — their rooms were not reachable anyway, and their owners
 * should decide deliberately.
 *
 * Idempotent: re-running it changes nothing. Run once per database, after the
 * schema push and before announcing the release.
 *
 * Env vars (POSTGRES_PRISMA_URL) must be injected before the process starts —
 * @/lib/prisma reads it at import time, too early for a same-file dotenv
 * call to race safely. Same wrapper as scripts/reconcile-r2.ts:
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-space-published.ts          # dry run
 *   npx dotenv -e .env.local -- npx tsx scripts/backfill-space-published.ts --apply  # write
 */

import prisma from '@/lib/prisma'

async function main() {
  const apply = process.argv.includes('--apply')

  const candidates = await prisma.exhibition.findMany({
    where: { published: true, spacePublished: false },
    select: { id: true, mainTitle: true, url: true },
  })

  if (candidates.length === 0) {
    console.log('Nothing to do — every published exhibition already has its 3D room on.')
    return
  }

  console.log(`${candidates.length} published exhibition(s) with the 3D room off:`)
  for (const exhibition of candidates) {
    console.log(`  ${exhibition.url}  ${exhibition.mainTitle}`)
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to switch these rooms on.')
    return
  }

  const { count } = await prisma.exhibition.updateMany({
    where: { published: true, spacePublished: false },
    data: { spacePublished: true },
  })
  console.log(`\nSwitched on ${count} room(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
