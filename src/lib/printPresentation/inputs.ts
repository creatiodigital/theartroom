import { canonicalJson, fnv1a } from '@/lib/bake/hash'

import {
  COPY_NUMBERS,
  LOOK_VERSION,
  PASSEPARTOUT_LOOK,
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
  /** Whether its frame holds a passepartout (`Artwork.presentationPassepartout`). */
  presentationPassepartout: boolean
  /** No original file: its web image's width over height (`Artwork.presentationRatio`). */
  presentationRatio: number | null
}

/** Everything a render needs, and the fingerprint that says whether a stored one still fits. */
export type PresentationInputs = {
  mode: PresentationMode
  /** Limited only: N in the pencilled "copy/N". */
  edition: number | null
  /** The frame it's rendered in; null for the bare sheet. */
  frame: PresentationFrame | null
  /** A passepartout in the frame; never for the bare sheet. */
  passepartout: boolean
  /** Image width over height, to 4 decimals. */
  ratio: number
  seed: number
  fingerprint: string
}

const positive = (n: number | null): n is number => typeof n === 'number' && n > 0

/**
 * A work's shape, width over height: its original file's or, for a work with no original file,
 * its web image's (measured once, `measureMissingRatios`). Null when neither is known.
 */
export function shapeOf(
  src: Pick<PresentationSource, 'originalWidth' | 'originalHeight' | 'presentationRatio'>,
): number | null {
  if (positive(src.originalWidth) && positive(src.originalHeight)) {
    return src.originalWidth / src.originalHeight
  }
  return positive(src.presentationRatio) ? src.presentationRatio : null
}

/**
 * The presentation an artwork gets, or null when it gets none (not an image, or its shape is
 * unknown) and keeps today's plain image.
 *
 * The pencilled number only for a limited edition that is for sale and has its print size set
 * up; everything else carries none — open editions, and works not yet for sale (the owner: "treat
 * them as open editions"). Pausing a size for a fix doesn't change the mode. Any work is framed
 * (dark wood unless another frame is picked), with or without a passepartout, or, if "no frame" is
 * picked, the bare sheet.
 */
export function presentationInputs(src: PresentationSource): PresentationInputs | null {
  if (src.artworkType !== 'image') return null
  const shape = shapeOf(src)
  if (shape === null) return null

  const limited =
    src.printEnabled && src.editionType === 'limited' && positive(src.firstVariantEditionSize)
  const mode: PresentationMode = limited ? 'limited' : 'framed'
  const edition = limited ? src.firstVariantEditionSize : null
  const frame = frameOf(src.presentationFrame)
  const passepartout = frame !== null && src.presentationPassepartout
  const ratio = Math.round(shape * 10000) / 10000
  const seed = seedForArtwork(src.id)
  const shot = { mode, edition, frame, passepartout, ratio, seed }
  return { ...shot, fingerprint: presentationFingerprint(shot) }
}

/**
 * What a render of this shot is called: changes whenever the shot would look different. The
 * copy-number rule counts only where a number is pencilled (a new rule re-renders just those); the
 * passepartout only where there is one, so the works without it kept their renders.
 */
export function presentationFingerprint(shot: Omit<PresentationInputs, 'fingerprint'>): string {
  const { mode, edition, ratio, seed, frame, passepartout } = shot
  return fnv1a(
    canonicalJson([
      LOOK_VERSION,
      mode,
      edition,
      ratio,
      seed,
      frame,
      ...(edition !== null ? [COPY_NUMBERS] : []),
      ...(passepartout ? ['passepartout', PASSEPARTOUT_LOOK] : []),
    ]),
  )
}
