/**
 * Record an address that changed before renames were recorded (AR-193): from then on the old one
 * sends visitors and search engines on to the current page (308), like every later rename, which
 * the artwork, exhibition and artist saves record themselves (src/lib/seo/slugRedirects.ts).
 *
 * Nothing is fixed in code: the old slug and the current one are the arguments, and the target is
 * looked up by its current slug, so the redirect follows it through any later rename.
 *
 * Dry run by default; `--apply` writes. Idempotent. Env vars (POSTGRES_PRISMA_URL) must be injected
 * before the process starts (@/lib/prisma reads them at import time):
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/add-slug-redirect.ts <kind> <old-slug> <current-slug> [--apply]
 *
 * <kind>: artwork (its slug) | exhibition (its URL, the last part of the address) | artist (handler).
 */

import prisma from '@/lib/prisma'
import type { SlugKind } from '@/lib/seo/slugRedirects'

const KINDS: SlugKind[] = ['artwork', 'exhibition', 'artist']

async function targetId(kind: SlugKind, current: string): Promise<string | null> {
  if (kind === 'artwork') {
    return (
      (await prisma.artwork.findUnique({ where: { slug: current }, select: { id: true } }))?.id ??
      null
    )
  }
  if (kind === 'exhibition') {
    return (
      (await prisma.exhibition.findUnique({ where: { url: current }, select: { id: true } }))?.id ??
      null
    )
  }
  return (
    (await prisma.user.findUnique({ where: { handler: current }, select: { id: true } }))?.id ??
    null
  )
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--apply')
  const apply = process.argv.includes('--apply')
  const [kind, oldSlug, current] = args as [SlugKind, string, string]

  if (!KINDS.includes(kind) || !oldSlug || !current) {
    console.log(
      'Usage: add-slug-redirect.ts <artwork|exhibition|artist> <old-slug> <current-slug> [--apply]',
    )
    process.exitCode = 1
    return
  }
  if (oldSlug === current) {
    console.log('The old and current slugs are the same: nothing to redirect.')
    process.exitCode = 1
    return
  }

  const id = await targetId(kind, current)
  if (!id) {
    console.log(`No ${kind} with the current slug "${current}".`)
    process.exitCode = 1
    return
  }
  // An old slug that is a live page again never redirects (the page answers first); say so.
  const live = await targetId(kind, oldSlug)
  if (live)
    console.log(`Note: "${oldSlug}" is a live ${kind} today, so this only applies if it changes.`)

  const existing = await prisma.slugRedirect.findUnique({
    where: { kind_oldSlug: { kind, oldSlug } },
    select: { targetId: true },
  })
  if (existing?.targetId === id) {
    console.log(`Already recorded: ${kind} "${oldSlug}" → "${current}". Nothing to do.`)
    return
  }

  console.log(
    `${apply ? 'Recording' : 'Would record'}: ${kind} "${oldSlug}" → "${current}" (${id})`,
  )
  if (!apply) {
    console.log('Dry run. Add --apply to write.')
    return
  }
  await prisma.slugRedirect.upsert({
    where: { kind_oldSlug: { kind, oldSlug } },
    create: { kind, oldSlug, targetId: id },
    update: { targetId: id },
  })
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error('add-slug-redirect failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
