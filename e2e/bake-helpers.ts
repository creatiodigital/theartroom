import type { Prisma } from '@/generated/prisma/client'
import type { BakeRecord } from '@/lib/bake/bakeRecord'
import { loadBakeFingerprint } from '@/lib/bake/loadBakeFingerprint'
import prisma from '@/lib/prisma'

/** A complete, valid BakeRecord (AR-161) for fixtures. No map files behind it. */
export const bakeRecord = (
  id: string,
  fingerprint: string,
  reviewedAt: string | null,
  maps: BakeRecord['maps'] = [],
): BakeRecord => ({
  id,
  fingerprint,
  bakerVersion: 1,
  unwrapHash: 'hash',
  unwrapStats: [[1, 2, 3, 4, 5]],
  maps,
  camera: { exposure: 1, whiteBalance: [1, 1, 1] },
  artLight: {},
  bakedAt: '2026-10-19T00:00:00.000Z',
  bakedBy: 'e2e',
  ms: 1,
  reviewedAt,
})

/**
 * Gives a fixture exhibition a draft bake made for the room exactly as it stands now and
 * reviewed by an admin — what a baked space needs before its room can go public. Call it
 * after the fixture's placed rows exist (they are part of the fingerprint).
 */
export async function giveReviewedBake(exhibitionId: string, bakeId = 'e2e-bake') {
  const bake = bakeRecord(bakeId, await loadBakeFingerprint(exhibitionId), new Date().toISOString())
  await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { bake: bake as unknown as Prisma.InputJsonValue },
  })
  return bake
}
