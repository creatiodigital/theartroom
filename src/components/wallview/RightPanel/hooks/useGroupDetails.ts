import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

export const useGroupDetails = () => {
  const groupProperties = useSelector((state: RootState) => state.wallView.artworkGroup)
  const wallWidth = useSelector((state: RootState) => state.wallView.wallWidth)
  const wallHeight = useSelector((state: RootState) => state.wallView.wallHeight)

  const { groupX, groupY, groupWidth, groupHeight } = groupProperties

  // Wall dimensions in 2D scale (meters * 100)
  const wallWidth2d = (wallWidth || 0) * 100
  const wallHeight2d = (wallHeight || 0) * 100

  // Calculate group center position
  const centerX = groupX + groupWidth / 2
  const centerY = groupY + groupHeight / 2

  // Calculate distances from all 4 wall edges to group center
  const fromTop = centerY
  const fromBottom = wallHeight2d - centerY
  const fromLeft = centerX
  const fromRight = wallWidth2d - centerX

  return {
    groupWidth: Math.round(groupWidth),
    groupHeight: Math.round(groupHeight),
    fromTop: Math.round(fromTop),
    fromBottom: Math.round(fromBottom),
    fromLeft: Math.round(fromLeft),
    fromRight: Math.round(fromRight),
  }
}
