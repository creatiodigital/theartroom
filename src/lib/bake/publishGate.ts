import { isBakeRecord } from './bakeRecord'

/**
 * Why the server refused to show a baked space's room to visitors (AR-161). Shared by the
 * publish route (409 body) and the admin dashboard (the inline explanation).
 */
export type BakeGateError = 'BAKE_REQUIRED' | 'BAKE_STALE' | 'BAKE_UNREVIEWED'

export const BAKE_GATE_MESSAGES: Record<BakeGateError, string> = {
  BAKE_REQUIRED: 'Bake the room before publishing it.',
  BAKE_STALE: 'The room changed since the last bake — bake it again.',
  BAKE_UNREVIEWED: 'Open the baked room to review it before publishing.',
}

export function isBakeGateError(value: unknown): value is BakeGateError {
  return value === 'BAKE_REQUIRED' || value === 'BAKE_STALE' || value === 'BAKE_UNREVIEWED'
}

/**
 * The refusal for publishing `bake` with the room as it stands (`fingerprint`), or null
 * when the bake is current and the admin reviewed it. A stale bake is reported as stale
 * even when unreviewed: reviewing it can't help, only a new bake can.
 */
export function bakeGateError(bake: unknown, fingerprint: string): BakeGateError | null {
  if (!isBakeRecord(bake)) return 'BAKE_REQUIRED'
  if (bake.fingerprint !== fingerprint) return 'BAKE_STALE'
  if (bake.reviewedAt === null) return 'BAKE_UNREVIEWED'
  return null
}
