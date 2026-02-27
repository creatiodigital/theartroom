'use client'

import { memo } from 'react'
import type { RefObject } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import { ArtisticSound } from '@/components/wallview/ArtisticSound'
import { ArtisticText } from '@/components/wallview/ArtisticText'
import { ArtworkMeasurements } from '@/components/wallview/ArtworkMeasurements'
import { WALL_SCALE } from '@/components/wallview/constants'
import { Handles } from '@/components/wallview/Handles'
import { useMoveArtwork } from '@/components/wallview/hooks/useMoveArtwork'
import { chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'
import type { ResizeHandler } from '@/types/wallView'

import styles from './Artwork.module.scss'

type ArtworkProps = {
  artwork: TArtwork
  wallRef: RefObject<HTMLDivElement>
  boundingData: TDimensions | null
  scaleFactor: number
  onHandleResize: ResizeHandler
  setHoveredArtworkId: (id: string | null) => void
  groupArtworkHandlers: {
    handleAddArtworkToGroup: (id: string) => void
    handleRemoveArtworkGroup: () => void
  }
  preventClick: React.RefObject<boolean>
}

const Artwork = memo(
  ({
    artwork,
    wallRef,
    boundingData,
    scaleFactor,
    onHandleResize,
    setHoveredArtworkId,
    groupArtworkHandlers,
  }: ArtworkProps) => {
    const { id, artworkType } = artwork
    const dispatch = useDispatch()

    const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
    const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
    const exhibitionArtworksById = useSelector(
      (state: RootState) => state.exhibition.exhibitionArtworksById,
    )

    const artworkPositions = exhibitionArtworksById[id]
    const { posX2d, posY2d, height2d, width2d } = artworkPositions

    // Calculate how much frame + passepartout borders add around the image
    const { showFrame, frameSize, imageUrl, showPassepartout, passepartoutSize } = artwork
    const scaleMul = WALL_SCALE / 100
    const frameBorderPx = showFrame && imageUrl && frameSize?.value ? frameSize.value * scaleMul : 0
    const ppBorderPx =
      showPassepartout && imageUrl && passepartoutSize?.value
        ? passepartoutSize.value * scaleMul
        : 0
    const totalBorderEachSide = frameBorderPx + ppBorderPx

    // The container grows to include borders. With border-box, the CSS borders
    // eat inward, so the image content naturally ends up at width2d × height2d.
    const containerWidth = width2d + totalBorderEachSide * 2
    const containerHeight = height2d + totalBorderEachSide * 2

    // Offset position so the image center stays at the same place
    const adjustedX = posX2d - totalBorderEachSide
    const adjustedY = posY2d - totalBorderEachSide

    const { handleArtworkDragStart, handleArtworkDragMove, handleArtworkDragEnd } = useMoveArtwork(
      wallRef,
      boundingData,
      scaleFactor,
    )

    const { handleAddArtworkToGroup, handleRemoveArtworkGroup } = groupArtworkHandlers

    const handleArtworkClick = (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation()

      if (event.shiftKey) {
        // Shift+click: add currently selected artwork AND clicked artwork to group
        if (currentArtworkId) {
          handleAddArtworkToGroup(currentArtworkId)
        }
        handleAddArtworkToGroup(id)
      } else {
        // Regular click: select only this artwork and clear any group
        dispatch(chooseCurrentArtworkId(id))
        handleRemoveArtworkGroup()
      }

      dispatch(showWizard())
    }

    const handleMouseEnter = () => setHoveredArtworkId(id)
    const handleMouseLeave = () => setHoveredArtworkId(null)

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
      handleArtworkDragMove(event.nativeEvent)
    }

    // For shapes with rotation, compute the axis-aligned bounding box (AABB)
    // so the dashed border encompasses the full rotated shape
    const rotationDeg = artworkType === 'shape' ? (artworkPositions.rotation ?? 0) : 0
    const rotationRad = (rotationDeg * Math.PI) / 180
    const hasShapeRotation = artworkType === 'shape' && rotationDeg !== 0

    let finalWidth = containerWidth
    let finalHeight = containerHeight
    let finalX = adjustedX
    let finalY = adjustedY

    if (hasShapeRotation) {
      // AABB of rotated rectangle
      const cosA = Math.abs(Math.cos(rotationRad))
      const sinA = Math.abs(Math.sin(rotationRad))
      finalWidth = containerWidth * cosA + containerHeight * sinA
      finalHeight = containerWidth * sinA + containerHeight * cosA
      // Adjust position to keep the center at the same place
      finalX = adjustedX - (finalWidth - containerWidth) / 2
      finalY = adjustedY - (finalHeight - containerHeight) / 2
    }

    return (
      <div
        id={`artwork-${id}`}
        className={styles.artwork}
        style={{
          top: `${finalY}px`,
          left: `${finalX}px`,
          width: `${finalWidth}px`,
          height: `${finalHeight}px`,
          zIndex: currentArtworkId === id ? 10 : 1,
          cursor: 'grab',
          overflow: artworkType === 'shape' ? 'visible' : undefined,
        }}
        onMouseDown={(event) => {
          event.stopPropagation()
          handleArtworkDragStart(event.nativeEvent, id)
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={() => handleArtworkDragEnd()}
        onClick={handleArtworkClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {currentArtworkId === id && (
          <ArtworkMeasurements width2d={finalWidth} height2d={finalHeight} />
        )}
        {currentArtworkId === id && artworkGroupIds.length <= 1 && (
          <Handles artworkId={id} handleResize={onHandleResize} />
        )}
        {artworkType === 'text' && <ArtisticText artworkId={id} />}
        {artworkType === 'image' && <ArtisticImage artwork={artwork} />}
        {artworkType === 'sound' && <ArtisticSound artworkId={id} />}
        {artworkType === 'shape' && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${containerWidth}px`,
              height: `${containerHeight}px`,
              transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
              backgroundColor: artwork.shapeColor ?? '#000000',
              opacity: artwork.shapeOpacity ?? 1,
              borderRadius: artwork.shapeType === 'circle' ? '50%' : 0,
            }}
          />
        )}
      </div>
    )
  },
)

Artwork.displayName = 'Artwork'

export default Artwork
