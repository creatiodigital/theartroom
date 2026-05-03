import prisma from '@/lib/prisma'

/**
 * DB readers for the e2e suite.
 *
 * Specs are read-only by contract — these helpers must never write,
 * and must never seed test-specific data. Anything they return
 * reflects the live state of the dev/staging DB at the moment the
 * test runs.
 */

export interface ArtworkRestrictions {
  id: string
  slug: string
  printEnabled: boolean
  printOptions: unknown
}

/**
 * Look up an artwork by slug and return the fields the wizard +
 * dashboard care about. Throws if the row doesn't exist so a spec
 * fails loudly when the fixture has drifted instead of silently
 * passing on a no-op.
 */
export async function getArtworkRestrictions(slug: string): Promise<ArtworkRestrictions> {
  const row = await prisma.artwork.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      printEnabled: true,
      printOptions: true,
    },
  })
  if (!row) {
    throw new Error(`Artwork "${slug}" not found in DB — check fixtures.ts and your dev DB`)
  }
  return row as ArtworkRestrictions
}

/**
 * Generic veto computation: ids in the catalog that are NOT in the
 * artist's allow-list. Empty allow-list ⇒ empty veto (the convention
 * is "field absent ⇒ no veto, all options pass through").
 */
export function vetoedIds(allowed: string[] | undefined, catalogIds: readonly string[]): string[] {
  if (!allowed) return []
  return catalogIds.filter((id) => !allowed.includes(id))
}
