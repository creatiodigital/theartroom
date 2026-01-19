import { useDispatch, useSelector } from 'react-redux'
import { Box3 } from 'three'

import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition, pushToHistory } from '@/redux/slices/exhibitionSlice'
import { editArtworkGroup } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'
import type { TAlign } from '@/types/wizard'

type TBoundingData = TDimensions & {
  boundingBox: Box3
  normal: { x: number; y: number; z: number }
}

export const useGroupHandlers = (artworkGroupIds: string[], boundingData: TBoundingData) => {
  const dispatch = useDispatch()
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)

  // Helper to move all artworks in group by delta
  const moveGroupByDelta = (deltaX: number, deltaY: number) => {
    artworkGroupIds.forEach((artworkId) => {
      const artwork = exhibitionArtworksById[artworkId]

      if (artwork) {
        const posX2d = artwork.posX2d + deltaX
        const posY2d = artwork.posY2d + deltaY
        const width2d = artwork.width2d
        const height2d = artwork.height2d

        const artworkPosition = {
          posX2d,
          posY2d,
          width2d,
          height2d,
        }

        const new3DCoordinate = convert2DTo3D(posX2d, posY2d, width2d, height2d, boundingData)

        dispatch(
          updateArtworkPosition({
            artworkId: artworkId,
            artworkPosition: { ...artworkPosition, ...new3DCoordinate },
          }),
        )
      }
    })
  }

  // Handler for "from left" input - distance from left wall edge to group center
  const handleFromLeftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromLeft = Number(e.target.value) * 100
    const groupCenterX = fromLeft
    const newGroupX = groupCenterX - artworkGroup.groupWidth / 2
    const deltaX = newGroupX - artworkGroup.groupX

    dispatch(pushToHistory())
    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: artworkGroup.groupY }))
    moveGroupByDelta(deltaX, 0)
  }

  // Handler for "from right" input - distance from right wall edge to group center
  const handleFromRightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromRight = Number(e.target.value) * 100
    const wallWidth2d = (wallWidth || 0) * 100
    const groupCenterX = wallWidth2d - fromRight
    const newGroupX = groupCenterX - artworkGroup.groupWidth / 2
    const deltaX = newGroupX - artworkGroup.groupX

    dispatch(pushToHistory())
    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: artworkGroup.groupY }))
    moveGroupByDelta(deltaX, 0)
  }

  // Handler for "from top" input - distance from top wall edge to group center
  const handleFromTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromTop = Number(e.target.value) * 100
    const groupCenterY = fromTop
    const newGroupY = groupCenterY - artworkGroup.groupHeight / 2
    const deltaY = newGroupY - artworkGroup.groupY

    dispatch(pushToHistory())
    dispatch(editArtworkGroup({ groupX: artworkGroup.groupX, groupY: newGroupY }))
    moveGroupByDelta(0, deltaY)
  }

  // Handler for "from bottom" input - distance from bottom wall edge to group center
  const handleFromBottomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fromBottom = Number(e.target.value) * 100
    const wallHeight2d = (wallHeight || 0) * 100
    const groupCenterY = wallHeight2d - fromBottom
    const newGroupY = groupCenterY - artworkGroup.groupHeight / 2
    const deltaY = newGroupY - artworkGroup.groupY

    dispatch(pushToHistory())
    dispatch(editArtworkGroup({ groupX: artworkGroup.groupX, groupY: newGroupY }))
    moveGroupByDelta(0, deltaY)
  }

  const alignGroupToWall = (alignment: TAlign) => {
    if (!wallHeight || !wallWidth) {
      console.warn('Wall dimensions are not available, cannot align group.')
      return
    }
    let newGroupX = artworkGroup.groupX
    let newGroupY = artworkGroup.groupY

    switch (alignment) {
      case 'verticalTop':
        newGroupY = 0
        break
      case 'verticalCenter':
        newGroupY = (wallHeight * 100) / 2 - artworkGroup.groupHeight / 2
        break
      case 'verticalBottom':
        newGroupY = wallHeight * 100 - artworkGroup.groupHeight
        break
      case 'horizontalLeft':
        newGroupX = 0
        break
      case 'horizontalCenter':
        newGroupX = (wallWidth * 100) / 2 - artworkGroup.groupWidth / 2
        break
      case 'horizontalRight':
        newGroupX = wallWidth * 100 - artworkGroup.groupWidth
        break
      default:
        console.warn('Invalid alignment type:', alignment)
        return
    }

    const deltaX = newGroupX - artworkGroup.groupX
    const deltaY = newGroupY - artworkGroup.groupY

    dispatch(pushToHistory())
    dispatch(editArtworkGroup({ groupX: newGroupX, groupY: newGroupY }))
    moveGroupByDelta(deltaX, deltaY)
  }

  return {
    handleFromLeftChange,
    handleFromRightChange,
    handleFromTopChange,
    handleFromBottomChange,
    alignGroupToWall,
  }
}
