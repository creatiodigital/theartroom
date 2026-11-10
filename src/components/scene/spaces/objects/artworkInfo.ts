import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { openArtworkModal, showArtworkPanel } from '@/redux/slices/dashboardSlice'
import type { RootState } from '@/redux/store'

/**
 * What a double click or tap on a work opens: straight to its details, which sit over the room and
 * close back to it, the camera untouched. The side panel before them, and its "View Details", was
 * the same work twice: phones dropped it first (AR-177), then tablets and laptops (owner,
 * 2026-11-10: "this drawer sidebar is redundant in desktop and tablet"). The editor keeps the
 * panel: it has no details to open.
 */
export const artworkInfoAction = (inEditor: boolean) =>
  inEditor ? showArtworkPanel() : openArtworkModal()

/** Opens a work's information; the work must already be the current one. */
export const useShowArtworkInfo = () => {
  const dispatch = useDispatch()
  const isEditMode = useSelector((state: RootState) => state.dashboard.isEditMode)
  return useCallback(() => dispatch(artworkInfoAction(isEditMode)), [dispatch, isEditMode])
}
