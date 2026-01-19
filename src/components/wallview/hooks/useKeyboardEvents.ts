import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { deleteArtwork } from '@/redux/slices/artworkSlice'
import { deleteArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { removeGroup, setShiftKeyDown, chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'
import { hideWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'

export const useKeyboardEvents = (currentArtworkId: string | null, isMouseOver: boolean) => {
  const dispatch = useDispatch()
  const isEditingArtwork = useSelector((state: RootState) => state.dashboard.isEditingArtwork)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const isGroupHovered = useSelector((state: RootState) => state.wallView.isGroupHovered)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingArtwork) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (currentArtworkId && isMouseOver) {
          dispatch(deleteArtwork({ artworkId: currentArtworkId }))
          dispatch(deleteArtworkPosition({ artworkId: currentArtworkId }))
          dispatch(removeGroup())
          dispatch(chooseCurrentArtworkId(null))
          dispatch(hideWizard())
        }

        if (isGroupHovered && artworkGroupIds.length > 0) {
          artworkGroupIds.forEach((artworkId) => {
            dispatch(deleteArtwork({ artworkId }))
            dispatch(deleteArtworkPosition({ artworkId }))
          })
          dispatch(removeGroup())
          dispatch(chooseCurrentArtworkId(null))
          dispatch(hideWizard())
        }
      }

      if (e.key === 'Shift') {
        dispatch(setShiftKeyDown(true))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        dispatch(setShiftKeyDown(false))
      }
    }

    // Reset shift key when window loses focus (prevents stuck shift state)
    const handleBlur = () => {
      dispatch(setShiftKeyDown(false))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [currentArtworkId, isMouseOver, isEditingArtwork, isGroupHovered, artworkGroupIds, dispatch])
}
