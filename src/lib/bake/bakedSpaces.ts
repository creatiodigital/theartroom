/**
 * The spaces whose rooms are lit by a stored bake (AR-161). The per-space switch: the Bake
 * button, the bake preview link and the publish gate exist only in these spaces; every
 * other space keeps today's publishing and preview unchanged.
 */
export const BAKED_SPACES: ReadonlySet<string> = new Set(['paris', 'vienna', 'madrid'])

export function isBakedSpace(spaceId: string | null | undefined): boolean {
  return typeof spaceId === 'string' && BAKED_SPACES.has(spaceId)
}
