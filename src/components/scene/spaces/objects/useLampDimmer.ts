'use client'

import { useSelector } from 'react-redux'

import { isBakedSpace } from '@/lib/bake/bakedSpaces'
import { dimmerFraction } from '@/lib/bake/dimmer'
import type { RootState } from '@/redux/store'

/**
 * The artist's two lamp dimmers (AR-161, spec rule 7), as the lamps and the bake read them.
 * `recessed` is the ceiling lamps' dimmer: the recessed lamps and Madrid's round lamps.
 */
type DimmedLamps = 'track' | 'recessed'

/** The stored slider level, 4 when unset — what today's realtime lamps read. */
export const useLampLevel = (lamps: DimmedLamps): number => {
  const stored = useSelector((state: RootState) =>
    lamps === 'track'
      ? state.exhibition.trackLampIntensity
      : state.exhibition.recessedLampIntensity,
  )
  return stored ?? 4
}

/**
 * In a baked space: the share (0.5–1) of the space's calibrated light these lamps give, per
 * the artist's dimmer. Undefined in any other space, whose lamps keep today's behaviour.
 */
export const useBakedDimmer = (lamps: DimmedLamps): number | undefined => {
  const level = useLampLevel(lamps)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  return isBakedSpace(spaceId) ? dimmerFraction(level) : undefined
}
