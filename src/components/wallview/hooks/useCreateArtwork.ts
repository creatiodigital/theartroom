import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { v4 as uuidv4 } from 'uuid'

import { WALL_SCALE } from '@/components/wallview/constants'
import { convert2DTo3D } from '@/components/wallview/utils'
import { createArtwork } from '@/redux/slices/artworkSlice'
import { createArtworkPosition } from '@/redux/slices/exhibitionSlice'
import {
  chooseCurrentArtworkId,
  addArtworkToGroup,
  removeGroup,
} from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import type { TArtworkKind, TArtworkPosition } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'

export const useCreateArtwork = (boundingData: TDimensions) => {
  const dispatch = useDispatch()

  const sizeForType = (type: TArtworkKind) => (type === 'sound' ? 40 * (WALL_SCALE / 100) : WALL_SCALE)

  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const currentWallId = useSelector((s: RootState) => s.wallView.currentWallId)

  const handleCreateArtwork = useCallback(
    (artworkType: TArtworkKind) => {
      if (!boundingData || !wallWidth || !wallHeight) return

      const size = sizeForType(artworkType)
      const posX2d = (wallWidth * WALL_SCALE) / 2 - size / 2
      const posY2d = (wallHeight * WALL_SCALE) / 2 - size / 2

      const artworkId = uuidv4()

      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))
      dispatch(createArtwork({ id: artworkId, artworkType }))

      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const new3DCoordinate = convert2DTo3D(posX2d, posY2d, size, size, boundingData)

      const artworkPosition: TArtworkPosition = {
        id: artworkId,
        artworkId,
        wallId: currentWallId!,
        posX2d,
        posY2d,
        width2d: size,
        height2d: size,
        ...new3DCoordinate,
      }

      dispatch(createArtworkPosition({ artworkId, artworkPosition }))
    },
    [boundingData, wallWidth, wallHeight, dispatch, currentWallId],
  )

  const handleCreateArtworkDrag = useCallback(
    (artworkType: TArtworkKind, posX2d: number, posY2d: number) => {
      if (!boundingData) return

      const size = sizeForType(artworkType)
      const adjustedX = posX2d - size / 2
      const adjustedY = posY2d - size / 2

      const artworkId = uuidv4()

      dispatch(showWizard())
      dispatch(chooseCurrentArtworkId(artworkId))
      dispatch(createArtwork({ id: artworkId, artworkType }))

      dispatch(removeGroup())
      dispatch(addArtworkToGroup(artworkId))

      const new3DCoordinate = convert2DTo3D(
        adjustedX,
        adjustedY,
        size,
        size,
        boundingData,
      )

      const artworkPosition: TArtworkPosition = {
        id: artworkId,
        artworkId,
        wallId: currentWallId ?? '',
        posX2d: adjustedX,
        posY2d: adjustedY,
        width2d: size,
        height2d: size,
        ...new3DCoordinate,
      }

      dispatch(createArtworkPosition({ artworkId, artworkPosition }))
    },
    [boundingData, dispatch, currentWallId],
  )

  return useMemo(
    () => ({
      handleCreateArtwork,
      handleCreateArtworkDrag,
    }),
    [handleCreateArtwork, handleCreateArtworkDrag],
  )
}

