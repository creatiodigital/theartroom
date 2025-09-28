import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { RefObject } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { chooseCurrentArtworkId, removeGroup } from '@/redux/slices/wallViewSlice'
import { showWizard, hideWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'

export type TSelectionBox = {
  startX: number
  startY: number
  endX: number
  endY: number
}

export const useSelectBox = (
  wallRef: RefObject<HTMLDivElement | null>,
  scaleFactor: number,
  preventClick: RefObject<boolean>,
) => {
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )
  const allExhibitionArtworkIds = useSelector(
    (state: RootState) => state.exhibition.allExhibitionArtworkIds,
  )
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const isShiftKeyDown = useSelector((state: RootState) => state.wallView.isShiftKeyDown)

  const dispatch = useDispatch()
  const { handleAddArtworkToGroup } = useGroupArtwork()

  const [selectionBox, setSelectionBox] = useState<TSelectionBox | null>(null)
  const [draggingSelectBox, setDraggingSelectBox] = useState(false)
  const startPosition = useRef({ x: 0, y: 0 })
  const dragThreshold = 5

  const handleSelectMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!wallRef.current) return
      preventClick.current = true

      const rect = wallRef.current.getBoundingClientRect()
      const startX = (e.clientX - rect.left) / scaleFactor
      const startY = (e.clientY - rect.top) / scaleFactor
      startPosition.current = { x: startX, y: startY }
      setSelectionBox({ startX, startY, endX: startX, endY: startY })
      setDraggingSelectBox(false)
    },
    [wallRef, scaleFactor, preventClick],
  )

  const handleSelectMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!selectionBox || !wallRef.current) return
      const rect = wallRef.current.getBoundingClientRect()
      const endX = (e.clientX - rect.left) / scaleFactor
      const endY = (e.clientY - rect.top) / scaleFactor

      const deltaX = Math.abs(endX - startPosition.current.x)
      const deltaY = Math.abs(endY - startPosition.current.y)

      if (deltaX > dragThreshold || deltaY > dragThreshold) {
        if (!draggingSelectBox) setDraggingSelectBox(true)
        setSelectionBox((prev) => (prev ? { ...prev, endX, endY } : prev))
      }
    },
    [selectionBox, wallRef, scaleFactor, dragThreshold, draggingSelectBox],
  )

  const handleSelectMouseUp = useCallback(
    (e?: MouseEvent) => {
      if (!selectionBox || !draggingSelectBox) {
        setSelectionBox(null)
        setDraggingSelectBox(false)
        preventClick.current = false
        return
      }

      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }

      const { startX, startY, endX, endY } = selectionBox
      const minX = Math.min(startX, endX)
      const minY = Math.min(startY, endY)
      const maxX = Math.max(startX, endX)
      const maxY = Math.max(startY, endY)

      const filteredArtworks = allExhibitionArtworkIds
        .map((id) => exhibitionArtworksById[id])
        .filter((a) => a.wallId === currentWallId)

      const selectedArtworks = filteredArtworks.filter((a) => {
        const { posX2d: x, posY2d: y, width2d: w, height2d: h } = a
        return minX < x + w && maxX > x && minY < y + h && maxY > y
      })

      if (!isShiftKeyDown) {
        dispatch(chooseCurrentArtworkId(null))
        dispatch(removeGroup())
      }

      if (selectedArtworks.length === 1) {
        const only = selectedArtworks[0]
        if (only.id) {
          dispatch(chooseCurrentArtworkId(only.id))
          handleAddArtworkToGroup(only.id)
          dispatch(showWizard())
        }
      } else if (selectedArtworks.length > 1) {
        selectedArtworks.forEach((a) => a.id && handleAddArtworkToGroup(a.id))
        if (!isShiftKeyDown) {
          dispatch(chooseCurrentArtworkId(null))
        }
      } else {
        if (!isShiftKeyDown) {
          dispatch(chooseCurrentArtworkId(null))
          dispatch(removeGroup())
          dispatch(hideWizard())
        }
      }

      setSelectionBox(null)
      setDraggingSelectBox(false)

      setTimeout(() => {
        preventClick.current = false
      }, 0)
    },
    [
      selectionBox,
      draggingSelectBox,
      allExhibitionArtworkIds,
      exhibitionArtworksById,
      currentWallId,
      isShiftKeyDown,
      handleAddArtworkToGroup,
      dispatch,
      preventClick,
    ],
  )

  useEffect(() => {
    if (!draggingSelectBox) return
    const moveHandler = (event: MouseEvent) => handleSelectMouseMove(event)
    const upHandler = (event: MouseEvent) => handleSelectMouseUp(event)
    document.addEventListener('mousemove', moveHandler)
    document.addEventListener('mouseup', upHandler)
    return () => {
      document.removeEventListener('mousemove', moveHandler)
      document.removeEventListener('mouseup', upHandler)
    }
  }, [draggingSelectBox, handleSelectMouseMove, handleSelectMouseUp])

  return useMemo(
    () => ({
      handleSelectMouseDown,
      handleSelectMouseMove,
      handleSelectMouseUp: (e: React.MouseEvent<HTMLDivElement>) =>
        handleSelectMouseUp(e.nativeEvent),
      selectionBox,
    }),
    [handleSelectMouseDown, handleSelectMouseMove, handleSelectMouseUp, selectionBox],
  )
}
