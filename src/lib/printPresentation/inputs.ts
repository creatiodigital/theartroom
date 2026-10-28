import { canonicalJson, fnv1a } from '@/lib/bake/hash'

import {
  LOOK_VERSION,
  frameOf,
  seedForArtwork,
  type PresentationFrame,
  type PresentationMode,
} from './look'

/** What an artwork's presentation depends on, read from the database. */
export type PresentationSource = {
  id: string
  artworkType: string | null
  originalWidth: number | null
  originalHeight: number | null
  printEnabled: boolean
  editionType: string
  /** The edition size of the artwork's mandatory print size (`order: 0`), draft or published. */
  firstVariantEditionSize: number | null
  /** The frame picked for it (`Artwork.presentationFrame`). */
  presentationFrame: string | null
}

/** Everything a render needs, and the fingerprint that says whether a stored one still fits. */
export type PresentationInputs = {
  mode: PresentationMode
  /** Limited only: N in the pencilled "copy/N". */
  edition: number | null
  /** The frame it's rendered in; null for the bare sheet. */
  frame: PresentationFrame | null
  /** Image width over height, to 4 decimals. */
  ratio: number
  seed: number
  fingerprint: string
}

const positive = (n: number | null): n is number => typeof n === 'number' && n > 0

/**
 * The presentation an artwork gets, or null when it gets none (not an image, or its size is
 * unknown) and keeps today's plain image.
 *
 * The pencilled number only for a limited edition that is for sale and has its print size set
 * up; everything else carries none — open editions, and works not yet for sale (the owner: "treat
 * them as open editions"). Pausing a size for a fix doesn't change the mode. Any work is framed
 * (dark wood unless another frame is picked) or, if "no frame" is picked, the bare sheet.
 */
export function presentationInputs(src: PresentationSource): PresentationInputs | null {
  if (src.artworkType !== 'image') return null
  if (!positive(src.originalWidth) || !positive(src.originalHeight)) return null

  const limited =
    src.printEnabled && src.editionType === 'limited' && positive(src.firstVariantEditionSize)
  const mode: PresentationMode = limited ? 'limited' : 'framed'
  const edition = limited ? src.firstVariantEditionSize : null
  const frame = frameOf(src.presentationFrame)
  const ratio = Math.round((src.originalWidth / src.originalHeight) * 10000) / 10000
  const seed = seedForArtwork(src.id)
  const fingerprint = fnv1a(canonicalJson([LOOK_VERSION, mode, edition, ratio, seed, frame]))
  return { mode, edition, frame, ratio, seed, fingerprint }
}
