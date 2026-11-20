/**
 * READ-ONLY census: do the stored print presentations still match the code's fingerprint?
 *
 * 🔒 Before releasing any change near print presentations (owner, 2026-11-20: "make sure that when
 * deploying to prod, I won't lose the current framed renders"): run this against the target
 * database with the NEW code. Every stored render whose fingerprint no longer matches would read
 * as out of date on deploy. Compare the mismatch count with the same run on the old code (the
 * baseline): it must not grow. Nothing is written.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/census-presentation-fingerprints.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/census-presentation-fingerprints.ts
 *
 * Exit code 1 when any stored render mismatches (so a release check can stop on it).
 */
import prisma from '../src/lib/prisma'
import { presentationInputs } from '../src/lib/printPresentation/inputs'
import { loadPresentationSources } from '../src/lib/printPresentation/loadSources'

async function main() {
  const sources = await loadPresentationSources()
  const stored = sources.filter((s) => s.record)
  const mismatched = stored.filter((s) => presentationInputs(s)?.fingerprint !== s.record!.fingerprint)
  console.log(
    `stored renders: ${stored.length} · match: ${stored.length - mismatched.length} · mismatch: ${mismatched.length}`,
  )
  for (const s of mismatched) {
    console.log(`  ${s.id}  ${s.artistName} — ${s.title}  (stored ${s.record!.fingerprint})`)
  }
  await prisma.$disconnect()
  process.exit(mismatched.length > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(2)
})
