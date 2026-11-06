import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { isPhone } from '@/hooks/useIsPhone'
import { openArtworkModal, showArtworkPanel } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

/**
 * What a double click or tap on a work opens. On a phone the side panel fills the screen, so it and
 * the details behind its "View Details" were almost the same view twice: there it goes straight to
 * the details (AR-177), which sit over the room and close back to it, the camera untouched. Tablets
 * and laptops keep the side panel, and so does the editor, which has no details to open.
 */
export const artworkInfoAction = (onPhone: boolean, inEditor: boolean) =>
  onPhone && !inEditor ? openArtworkModal() : showArtworkPanel()

/** Opens a work's information; the work must already be the current one. */
export const useShowArtworkInfo = () => {
  const dispatch = useDispatch()
  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  return useCallback(
    () => dispatch(artworkInfoAction(isPhone(), isEditMode)),
    [dispatch, isEditMode],
  )
}
