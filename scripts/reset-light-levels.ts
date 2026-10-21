/**
 * One-off for AR-161 rollout: every exhibition in a baked space gets its two lamp dimmers back
 * to the standard (spec "Levels reset to the standard at rollout"), and its track lamps' beam
 * and throw and its ceiling color to the values its space's approved look was made with
 * (`APPROVED_ROOM_SETTINGS`: beam 0.8 rad in Paris and Vienna, 0.45 in Madrid; no cut-off;
 * a white ceiling).
 *
 * The stored levels were tuned blind, under the old fake light (vivrière ceiling lamps 8,
 * kritzendorf track lamps 1.4…). In a baked space the dimmers now mean 50–100% of the space's
 * calibrated lamps (slider 2–4, 4 = 100%), so the rollout puts every exhibition at 4 and the
 * artist dims from there. The beam, throw and ceiling were the space's until 2026-10-20 (every
 * approved bake used the values above, whatever the exhibition stored); now the artist owns them
 * again, so the rollout starts every exhibition from the approved look.
 *
 * Writes ONLY `trackLampIntensity`, `recessedLampIntensity`, `trackLampAngle`,
 * `trackLampDistance` and `ceilingColor` (+ `hasPendingChanges` on a published or
 * preview-enabled exhibition that changes, exactly as the editor's save marks it). Never touches
 * the lamps' positions, rotations or on/off (`trackLampSettings`), the lighting set
 * (`ceilingLightMode`), wall colors, panels, or the visitors' snapshot: visitors keep what is
 * published until the exhibition is baked, reviewed and republished.
 *
 * Any change makes that exhibition's bake out of date (all five are in its fingerprint): run
 * this BEFORE baking.
 *
 * Idempotent. Same env wrapper as scripts/backfill-space-published.ts:
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-light-levels.ts          # dry run
 *   npx dotenv -e .env.local -- npx tsx scripts/reset-light-levels.ts --apply  # write
 */

import prisma from '@/lib/prisma'
import { BAKED_SPACES } from '@/lib/bake/bakedSpaces'
import { APPROVED_ROOM_SETTINGS, type ApprovedRoomSettings } from '@/lib/bake/spaceLooks'
import { throwLabel } from '@/lib/bake/trackThrow'

/** Slider 4 = 100% of the space's calibrated lamps. */
const STANDARD = 4
/** The one lighting set the baked looks were calibrated on (Paris, Vienna). */
const CALIBRATED_SET = 'track-plafond'

const show = (value: number | null) => (value === null ? 'null' : String(value))

const room = (r: {
  trackLampAngle: number | null
  trackLampDistance: number | null
  ceilingColor: string | null
}) =>
  `beam ${show(r.trackLampAngle)}, throw ${
    r.trackLampDistance === null ? 'null' : throwLabel(r.trackLampDistance)
  }, ceiling ${r.ceilingColor ?? 'null'}`

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
      trackLampAngle: true,
      trackLampDistance: true,
      ceilingColor: true,
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
  const changing: { id: string; target: ApprovedRoomSettings; pending: boolean }[] = []
  for (const e of exhibitions) {
    const target = APPROVED_ROOM_SETTINGS[e.spaceId]
    if (!target) throw new Error(`No approved room settings for the baked space "${e.spaceId}"`)
    const levelsChange = e.trackLampIntensity !== STANDARD || e.recessedLampIntensity !== STANDARD
    const roomChanges =
      e.trackLampAngle !== target.trackLampAngle ||
      e.trackLampDistance !== target.trackLampDistance ||
      e.ceilingColor?.toLowerCase() !== target.ceilingColor
    const changes = levelsChange || roomChanges
    if (changes) changing.push({ id: e.id, target, pending: e.published || e.previewEnabled })
    const levels = `track ${show(e.trackLampIntensity)}, recessed ${show(e.recessedLampIntensity)}`
    const notes = [
      e.published ? 'published' : 'unpublished',
      changes && e.bake ? 'its draft bake goes out of date' : null,
    ].filter(Boolean)
    console.log(`  ${e.spaceId.padEnd(7)} ${e.url}  ${e.mainTitle}  (${notes.join('; ')})`)
    console.log(
      `          levels  before: ${levels}  →  after: ${
        levelsChange ? `track ${STANDARD}, recessed ${STANDARD}` : 'unchanged'
      }`,
    )
    console.log(
      `          room    before: ${room(e)}  →  after: ${roomChanges ? room(target) : 'unchanged'}`,
    )
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
    console.log('\nNothing to do — every exhibition is already at the approved values.')
    return
  }

  if (!apply) {
    console.log(
      `\nDry run: ${changing.length} exhibition(s) would change. Re-run with --apply to write.`,
    )
    return
  }

  for (const { id, target, pending } of changing) {
    await prisma.exhibition.update({
      where: { id },
      data: {
        trackLampIntensity: STANDARD,
        recessedLampIntensity: STANDARD,
        trackLampAngle: target.trackLampAngle,
        trackLampDistance: target.trackLampDistance,
        ceilingColor: target.ceilingColor,
        // As the editor's save does: the live row now differs from what visitors see.
        ...(pending ? { hasPendingChanges: true } : {}),
      },
    })
  }
  console.log(
    `\nReset ${changing.length} exhibition(s) to track ${STANDARD}, recessed ${STANDARD} and their space's approved beam, throw and ceiling.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
