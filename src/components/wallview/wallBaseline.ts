import type { Dispatch } from '@reduxjs/toolkit'

import { snapshotArtworks } from '@/redux/slices/artworkSlice'
import { snapshotExhibition } from '@/redux/slices/exhibitionSlice'

/**
 * What Cancel returns to: the wall as it was last saved or loaded (questions.md Q146 a). Taken when
 * a wall opens (a placeholder's double-click; a `?wallId=` link once the works are in) and again
 * after each accepted save that keeps the wall open (Save, View details' save-first).
 */
export const keepAsCancelPoint = (dispatch: Dispatch) => {
  dispatch(snapshotExhibition())
  dispatch(snapshotArtworks())
}

/**
 * A wall opened from a `?wallId=` link has no Cancel point: only a placeholder's double-click takes
 * one. It is taken once this exhibition's works are in the store. The link can open the wall before
 * they arrive (questions.md Q151: the loader's `isReady` starts true), and a Cancel point of the
 * empty store would make Cancel empty the wall. `loadedExhibitionId` is the loader's: set only
 * after it has put every work of that exhibition in the store (useLoadExhibitionArtworks).
 */
export const needsLinkCancelPoint = ({
  isWallView,
  hasCancelPoint,
  exhibitionId,
  loadedExhibitionId,
}: {
  isWallView: boolean
  hasCancelPoint: boolean
  exhibitionId: string | undefined
  loadedExhibitionId: string | null
}): boolean =>
  isWallView && !hasCancelPoint && !!exhibitionId && loadedExhibitionId === exhibitionId
