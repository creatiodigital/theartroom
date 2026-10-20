/**
 * One-off for AR-161 rollout: every exhibition in a baked space gets its two lamp dimmers back
 * to the standard (spec "Levels reset to the standard at rollout").
 *
 * The stored levels were tuned blind, under the old fake light (vivrière ceiling lamps 8,
 * kritzendorf track lamps 1.4…). In a baked space the dimmers now mean 50–100% of the space's
 * calibrated lamps (slider 2–4, 4 = 100%), so the rollout puts every exhibition at 4 and the
 * artist dims from there.
 *
 * Writes ONLY `trackLampIntensity` and `recessedLampIntensity` (+ `hasPendingChanges` on a
 * published or preview-enabled exhibition whose levels change, exactly as the editor's save
 * marks it). Never touches the lamps' positions, rotations or on/off (`trackLampSettings`), the
 * lighting set (`ceilingLightMode`), wall colors, panels, or the visitors' snapshot: visitors
 * keep what is published until the exhibition is baked, reviewed and republished.
 *
 * A changed level makes that exhibition's bake out of date (the levels are in its
 * fingerprint): run this BEFORE baking.
 *
 * Idempotent. Same env wrapper as scripts/backfill-space-published.ts:
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-light-levels.ts          # dry run
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-light-levels.ts --apply  # write
 */

import prisma from '@/lib/prisma'
import { BAKED_SPACES } from '@/lib/bake/bakedSpaces'

/** Slider 4 = 100% of the space's calibrated lamps. */
const STANDARD = 4
/** The one lighting set the baked looks were calibrated on (Paris, Vienna). */
const CALIBRATED_SET = 'track-plafond'

const show = (value: number | null) => (value === null ? 'null' : String(value))

async function main() {
  const apply = process.argv.includes('--apply')

  const exhibitions = await prisma.exhibition.findMany({
    where: { spaceId: { in: [...BAKED_SPACES] } },
    select: {
      id: true,
      url: true,
      mainTitle: true,
      spaceId: true,
      published: true,
      previewEnabled: true,
      trackLampIntensity: true,
      recessedLampIntensity: true,
      ceilingLightMode: true,
      bake: true,
    },
    orderBy: [{ spaceId: 'asc' }, { url: 'asc' }],
  })

  if (exhibitions.length === 0) {
    console.log(`No exhibitions in the baked spaces (${[...BAKED_SPACES].join(', ')}).`)
    return
  }

  console.log(
    `${exhibitions.length} exhibition(s) in the baked spaces (${[...BAKED_SPACES].join(', ')}):\n`,
  )
  const changing: typeof exhibitions = []
  for (const e of exhibitions) {
    const changes = e.trackLampIntensity !== STANDARD || e.recessedLampIntensity !== STANDARD
    if (changes) changing.push(e)
    const before = `track ${show(e.trackLampIntensity)}, recessed ${show(e.recessedLampIntensity)}`
    const after = changes ? `track ${STANDARD}, recessed ${STANDARD}` : 'unchanged'
    const notes = [
      e.published ? 'published' : 'unpublished',
      changes && e.bake ? 'its draft bake goes out of date' : null,
    ].filter(Boolean)
    console.log(`  ${e.spaceId.padEnd(7)} ${e.url}  ${e.mainTitle}`)
    console.log(`          before: ${before}  →  after: ${after}  (${notes.join('; ')})`)
    // The set is never written here; a baked look exists only for the calibrated one.
    const set = e.ceilingLightMode ?? CALIBRATED_SET
    if (set !== CALIBRATED_SET) {
      const madrid =
        e.spaceId === 'madrid' ? ' (Madrid has no track lamps and ignores the set)' : ''
      console.log(
        `          WARNING: lighting set is "${set}", not the calibrated "${CALIBRATED_SET}"${madrid} — not changed by this script`,
      )
    }
  }

  if (changing.length === 0) {
    console.log('\nNothing to do — every exhibition is already at the standard.')
    return
  }

  if (!apply) {
    console.log(
      `\nDry run: ${changing.length} exhibition(s) would change. Re-run with --apply to write.`,
    )
    return
  }

  for (const e of changing) {
    await prisma.exhibition.update({
      where: { id: e.id },
      data: {
        trackLampIntensity: STANDARD,
        recessedLampIntensity: STANDARD,
        // As the editor's save does: the live row now differs from what visitors see.
        ...(e.published || e.previewEnabled ? { hasPendingChanges: true } : {}),
      },
    })
  }
  console.log(
    `\nReset ${changing.length} exhibition(s) to track ${STANDARD}, recessed ${STANDARD}.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
