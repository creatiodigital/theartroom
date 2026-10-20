import type { BakeRecord } from './bakeRecord'

export type EditorBakeStatus = 'none' | 'current' | 'stale'

/** The editor's reading of the draft bake against the room's light fingerprint now. */
export const editorBakeStatus = (
  bake: BakeRecord | null | undefined,
  fingerprint: string | undefined,
): EditorBakeStatus => {
  if (!bake) return 'none'
  return fingerprint !== undefined && bake.fingerprint === fingerprint ? 'current' : 'stale'
}
