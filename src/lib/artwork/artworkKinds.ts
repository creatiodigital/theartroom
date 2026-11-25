import type { TArtworkKind } from '@/types/artwork'

/** Every `Artwork.artworkType` the app knows. Client-safe (no Prisma). */
export const ARTWORK_KINDS = [
  'image',
  'text',
  'sound',
  'shape',
  'video',
  'object',
] as const satisfies readonly TArtworkKind[]

export const isArtworkKind = (value: unknown): value is TArtworkKind =>
  typeof value === 'string' && (ARTWORK_KINDS as readonly string[]).includes(value)

/**
 * Whether a kind hangs on a wall. Objects stand on the floor (docs/objects, step O6, not built
 * yet): until the Floor view exists, the wall editor and the 3D scene ignore them.
 */
export const hangsOnWall = (kind: string | null | undefined): boolean => kind !== 'object'
