'use client'

import { lazy, Suspense } from 'react'

import { BakedLighting } from './BakedLighting'
import { useShownStoredBake } from './bakedLook'
import { useBakePage } from './bakePage'

// The admin's bake (and `LightBaker` with it) loads only on the bake page: visitors never bake.
const BakeRunner = lazy(() => import('./BakeRunner'))

/**
 * ⚠️ AR-161 — the bake the room gets, mounted by every space's lights. In bake mode the admin's
 * bake runs (`BakeRunner`); otherwise a stored bake that will be shown (`shownStoredBake`:
 * published for visitors, the draft in review, a bake preview link) is applied as it is, in the
 * space's approved look. Nothing in the 3D editor (no bake page), and nothing once a stored bake
 * has failed to go on: the room keeps today's realtime look.
 */
export const RoomBake = () => {
  const page = useBakePage()
  const bake = useShownStoredBake()
  if (page?.mode === 'bake')
    return (
      <Suspense fallback={null}>
        <BakeRunner {...page.runner} />
      </Suspense>
    )
  if (!page || !bake) return null
  return <BakedLighting key={bake.id} bake={bake} />
}

export default RoomBake
