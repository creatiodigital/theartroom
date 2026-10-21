'use client'

import { createContext, useContext } from 'react'

import type { BakeRunnerProps } from './BakeRunner'

/**
 * ⚠️ AR-161 — what the visit page is for, as the room's lights need to know it:
 *
 * - `visit`: visitors (and the bake preview link) — a stored bake when there is one;
 * - `bake` (admin, `?bake=1`): the admin's bake runs (`BakeRunner`); nothing stored is shown;
 * - `review` (admin, `?review=1`): the draft bake exactly as visitors will get it — only a stored
 *   bake, never a bake made on the spot.
 *
 * Set by the visit page around the scene (React context reaches inside the canvas). Anywhere else
 * — the 3D editor — there is none (`null`): the room keeps today's realtime look.
 */
export type BakePage =
  | { mode: 'visit' }
  | { mode: 'review' }
  | { mode: 'bake'; runner: BakeRunnerProps }

const BakePageContext = createContext<BakePage | null>(null)

export const BakePageProvider = BakePageContext.Provider

export const useBakePage = (): BakePage | null => useContext(BakePageContext)
