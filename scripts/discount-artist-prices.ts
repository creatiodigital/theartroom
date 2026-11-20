/**
 * AR-186 one-off: lower every artist price by a fixed amount (default €50), so nobody has
 * to edit ~80 artworks by hand. Owner + artists, 2026-11-18: "make people start buying".
 *
 * WHAT IT TOUCHES — two columns, nothing else:
 *   - Artwork.printPriceCents   (the artist price of an open edition)
 *   - LimitedVariant.priceCents (the artist price of each limited-edition size)
 * Plain `UPDATE … SET <price> WHERE id = … AND <price> = <the price it read>`: no deletes, no
 * inserts, no other column (not even updatedAt). Orders, invoices, edition numbers, carts,
 * exhibitions and bakes are never read or written. Placed orders keep the prices they were
 * sold at; checkout re-prices from these columns; every price page is force-dynamic, so the
 * change shows the moment it commits.
 *
 * SAFE BY DEFAULT:
 *   - Dry run unless --apply. It prints the DB's project ref so you know which DB it read.
 *   - --apply / --undo also need --ref=<that project ref>: a wrong DB refuses to run.
 *   - Skips a price that would land below the floor (default €50), and a limited variant whose
 *     new price no longer covers its own paper (the admin's margin rule, at the DB's commission setting).
 *   - Writes every old price to out/price-snapshots/ (gitignored) BEFORE writing anything.
 *   - ONE discount per DB: --apply refuses while a snapshot for this DB exists that hasn't been
 *     undone (a second run would take another €50 off — it did, on dev, in testing).
 *   - Every row only changes if its price is still the one read, all in one transaction, so an
 *     artist editing in between is skipped rather than overwritten.
 *   - --undo=<snapshot> puts the old prices back (only where the price is still the new one)
 *     and renames the snapshot *.undone.json, which allows a fresh --apply.
 *
 * .env.local = dev DB; .env.db.prod = production DB.
 *   npx dotenv -e .env.local -- npx tsx scripts/discount-artist-prices.ts                    # dry run
 *   npx dotenv -e .env.local -- npx tsx scripts/discount-artist-prices.ts --apply --ref=<ref>
 *   npx dotenv -e .env.local -- npx tsx scripts/discount-artist-prices.ts --undo=<file> --ref=<ref>
 *   Options: --amount=50 (euros) --floor=50 (euros)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { Prisma } from '@/generated/prisma/client'
import { estimateVariantMarginCents } from '@/lib/editions/variantMargin'
import prisma from '@/lib/prisma'
import { getGalleryCommissionRates } from '@/lib/settings'

type Row = {
  table: 'Artwork' | 'LimitedVariant'
  id: string
  label: string
  oldCents: number
  newCents: number
}
type Snapshot = { ref: string; createdAt: string; amountCents: number; rows: Row[] }

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ??
  (process.argv.includes(`--${name}`) ? '' : undefined)

const euros = (c: number) => `€${(c / 100).toFixed(c % 100 ? 2 : 0)}`

const dbRef = (process.env.POSTGRES_PRISMA_URL ?? '').match(/postgres\.([a-z0-9]{20})/)?.[1]

const SNAPSHOT_DIR = path.join(process.cwd(), 'out', 'price-snapshots')

/** Snapshots of discounts on this DB that are still in force (not undone). */
const liveSnapshots = () =>
  existsSync(SNAPSHOT_DIR)
    ? readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith(`-${dbRef}.json`))
    : []

const cm = (n: number) => Number(n.toFixed(1))

function requireRef() {
  if (!dbRef) throw new Error('Could not read a project ref from POSTGRES_PRISMA_URL — refusing to write.')
  if (arg('ref') !== dbRef) {
    throw new Error(`This DB is ${dbRef}. Re-run with --ref=${dbRef} to confirm that is the one you mean.`)
  }
}

/** One guarded write: only if the price is still `from`. Returns rows changed (0 or 1). */
const write = (row: Row, from: number, to: number) =>
  row.table === 'Artwork'
    ? prisma.$executeRaw(Prisma.sql`
        UPDATE "Artwork" SET "printPriceCents" = ${to}
        WHERE "id" = ${row.id} AND "printPriceCents" = ${from}`)
    : prisma.$executeRaw(Prisma.sql`
        UPDATE "LimitedVariant" SET "priceCents" = ${to}
        WHERE "id" = ${row.id} AND "priceCents" = ${from}`)

async function undo(file: string) {
  requireRef()
  const snap = JSON.parse(readFileSync(file, 'utf8')) as Snapshot
  if (snap.ref !== dbRef) throw new Error(`Snapshot is from ${snap.ref}, this DB is ${dbRef}.`)
  const counts = await prisma.$transaction(snap.rows.map((r) => write(r, r.newCents, r.oldCents)))
  const restored = counts.filter((n) => n === 1).length
  console.log(`Restored ${restored} of ${snap.rows.length} prices.`)
  snap.rows.forEach((r, i) => {
    if (counts[i] !== 1) console.log(`  not restored (price changed since): ${r.label}`)
  })
  renameSync(file, file.replace(/\.json$/, '.undone.json'))
}

async function main() {
  const galleryRates = await getGalleryCommissionRates()
  console.log(
    `DB project ref: ${dbRef ?? 'UNKNOWN'} · gallery commission settings: open ${galleryRates.open * 100}%, limited ${galleryRates.limited * 100}%`,
  )

  const undoFile = arg('undo')
  if (undoFile) return undo(undoFile)

  const amountCents = Math.round(Number(arg('amount') ?? 50) * 100)
  const floorCents = Math.round(Number(arg('floor') ?? 50) * 100)
  if (!(amountCents > 0) || !(floorCents > 0)) throw new Error('--amount and --floor must be positive euros.')

  const artworks = await prisma.artwork.findMany({
    where: { OR: [{ printPriceCents: { not: null } }, { limitedVariants: { some: { priceCents: { not: null } } } }] },
    orderBy: [{ user: { name: 'asc' } }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      editionType: true,
      printEnabled: true,
      printPriceCents: true,
      user: { select: { name: true, lastName: true } },
      limitedVariants: {
        where: { priceCents: { not: null } },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          widthCm: true,
          heightCm: true,
          borderCm: true,
          sheetWidthCm: true,
          sheetHeightCm: true,
          priceCents: true,
        },
      },
    },
  })

  const change: Row[] = []
  const skipped: string[] = []
  for (const a of artworks) {
    const who = [a.user?.name, a.user?.lastName].filter(Boolean).join(' ')
    const tags = [a.editionType, a.printEnabled ? null : 'print sales off'].filter(Boolean).join(', ')
    const base = `${who} — ${a.title} (${tags})`

    if (a.printPriceCents != null) {
      const newCents = a.printPriceCents - amountCents
      const label = `${base}${a.editionType === 'limited' ? ' [unused open-edition price]' : ''}`
      if (newCents < floorCents) skipped.push(`${label}: ${euros(a.printPriceCents)} would go below ${euros(floorCents)}`)
      else change.push({ table: 'Artwork', id: a.id, label, oldCents: a.printPriceCents, newCents })
    }

    for (const v of a.limitedVariants) {
      const oldCents = v.priceCents!
      const newCents = oldCents - amountCents
      const label = `${base} · "${v.name}" ${cm(v.widthCm)}×${cm(v.heightCm)}`
      const margin = estimateVariantMarginCents({
        ...v,
        artistPriceCents: newCents,
        galleryRate: galleryRates.limited,
      })
      if (newCents < floorCents) skipped.push(`${label}: ${euros(oldCents)} would go below ${euros(floorCents)}`)
      else if (margin && margin.marginCents <= 0)
        skipped.push(`${label}: at ${euros(newCents)} it no longer covers its paper (${euros(margin.absorbedCents)})`)
      else change.push({ table: 'LimitedVariant', id: v.id, label, oldCents, newCents })
    }
  }

  console.log(`\nWILL CHANGE ${change.length} prices (−${euros(amountCents)} each):`)
  for (const r of change) console.log(`  ${euros(r.oldCents)} → ${euros(r.newCents)}  ${r.label}`)
  console.log(`\nSKIPPED ${skipped.length}:`)
  for (const s of skipped) console.log(`  ${s}`)

  if (arg('apply') === undefined) {
    console.log(`\nDry run — nothing written. To write: --apply --ref=${dbRef ?? '<ref>'}`)
    return
  }
  requireRef()
  const live = liveSnapshots()
  if (live.length) {
    throw new Error(
      `This DB already has a discount in force (${live.join(', ')}). Running again would take ` +
        `another ${euros(amountCents)} off. Undo it first, or delete the snapshot if you really mean to.`,
    )
  }

  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const file = path.join(SNAPSHOT_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${dbRef}.json`)
  const snap: Snapshot = { ref: dbRef!, createdAt: new Date().toISOString(), amountCents, rows: change }
  writeFileSync(file, JSON.stringify(snap, null, 2))
  console.log(`\nOld prices saved to ${file}`)

  const counts = await prisma.$transaction(change.map((r) => write(r, r.oldCents, r.newCents)))
  const done = counts.filter((n) => n === 1).length
  console.log(`Changed ${done} of ${change.length}.`)
  change.forEach((r, i) => {
    if (counts[i] !== 1) console.log(`  not changed (price changed since the read): ${r.label}`)
  })
  console.log(
    `Undo (with the same -e env file as this run): npx dotenv -e <env file> -- npx tsx ` +
      `scripts/discount-artist-prices.ts --undo=${path.relative(process.cwd(), file)} --ref=${dbRef}`,
  )
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
