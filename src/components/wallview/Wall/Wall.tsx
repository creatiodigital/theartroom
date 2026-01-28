'use client'

import { useGLTF } from '@react-three/drei'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { DragEvent } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Mesh } from 'three'

import { Artwork } from '@/components/wallview/Artwork'
import { Group } from '@/components/wallview/Group'
import { useAddExistingArtwork } from '@/components/wallview/hooks/useAddExistingArtwork'
import { useBoundingData } from '@/components/wallview/hooks/useBoundingData'
import { useCreateArtwork } from '@/components/wallview/hooks/useCreateArtwork'
import { useDeselectArtwork } from '@/components/wallview/hooks/useDeselectArtwork'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { useKeyboardEvents } from '@/components/wallview/hooks/useKeyboardEvents'
import { useResizeArtwork } from '@/components/wallview/hooks/useResizeArtwork'
import { useSelectBox } from '@/components/wallview/hooks/useSelectBox'
import { Human } from '@/components/wallview/Human'
import { DistanceLines } from '@/components/wallview/DistanceLines'
import { SelectionBox } from '@/components/wallview/SelectionBox'
import { convert2DTo3D } from '@/components/wallview/utils'
import { updateArtworkPosition } from '@/redux/slices/exhibitionSlice'
import { setShiftKeyDown } from '@/redux/slices/wallViewSlice'
import { setWallCoordinates, setWallDimensions } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import { toRuntimeArtwork } from '@/utils/artworkTransform'

import { Measurements } from '../Measurements'
import { AlignedLine } from './AlignedLine'
import styles from './Wall.module.scss'

export const Wall = () => {
  // Use exhibition spaceId to load the correct GLB for this exhibition
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId)
  const { nodes } = useGLTF(`/assets/spaces/${spaceId || 'classic'}.glb`) as unknown as {
    nodes: Record<string, Mesh>
  }

  const allIds = useSelector((state: RootState) => state.artworks.allIds)
  const artworksById = useSelector((state: RootState) => state.artworks.byId)
  const exhibitionArtworksById = useSelector(
    (state: RootState) => state.exhibition.exhibitionArtworksById,
  )

  const isDragging = useSelector((state: RootState) => state.wallView.isDragging)
  const isDraggingGroup = useSelector((state: RootState) => state.wallView.isDraggingGroup)
  const isResizing = useSelector((state: RootState) => state.wallView.isResizing)
  const currentWallId = useSelector((state: RootState) => state.wallView.currentWallId)
  const scaleFactor = useSelector((state: RootState) => state.wallView.scaleFactor)
  const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
  const [wallWidth, setWallWidth] = useState('')
  const [wallHeight, setWallHeight] = useState('')
  const [hoveredArtworkId, setHoveredArtworkId] = useState<string | null>(null)

  const isArtworkUploaded = useSelector((state: RootState) => state.wizard.isArtworkUploaded)
  const isHumanVisible = useSelector((state: RootState) => state.wallView.isHumanVisible)
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const alignedPairs = useSelector((state: RootState) => state.wallView.alignedPairs)
  const dispatch = useDispatch()
  const scaling = 100
  const humanHeight = 180
  const humanWidth = 70

  const wallRef = useRef<HTMLDivElement>(null!)
  const preventClick = useRef(false)

  const currentArtwork = exhibitionArtworksById[currentArtworkId ?? '']

  const boundingData = useBoundingData(nodes as Record<string, Mesh>, currentWallId)
  const { handleCreateArtworkDrag } = useCreateArtwork(boundingData!)
  const { handleAddExistingArtworkDrag } = useAddExistingArtwork(boundingData)

  const groupArtworkHandlers = useGroupArtwork()
  const { handleRemoveArtworkGroup } = groupArtworkHandlers

  const { handleSelectMouseDown, handleSelectMouseMove, handleSelectMouseUp, selectionBox } =
    useSelectBox(wallRef, scaleFactor, preventClick)

  const { handleResize } = useResizeArtwork(boundingData, scaleFactor, wallRef)

  useEffect(() => {
    return () => {
      dispatch(setShiftKeyDown(false))
    }
  }, [dispatch])

  const handleDropArtworkOnWall = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const artworkType = e.dataTransfer.getData('artworkType')
      const existingArtworkId = e.dataTransfer.getData('existingArtworkId')

      if (wallRef.current && boundingData) {
        const rect = wallRef.current.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * boundingData.width * scaling
        const y = ((e.clientY - rect.top) / rect.height) * boundingData.height * scaling

        // Handle existing artwork from media library
        if (existingArtworkId) {
          handleAddExistingArtworkDrag(existingArtworkId, x, y)
        }
        // Handle new artwork creation
        else if (artworkType === 'image' || artworkType === 'text') {
          handleCreateArtworkDrag(artworkType, x, y)
        }
      }
    },
    [wallRef, boundingData, scaling, handleCreateArtworkDrag, handleAddExistingArtworkDrag],
  )

  const handleDragArtworkOverWall = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    if (boundingData && wallRef.current) {
      const width = boundingData.width
      const height = boundingData.height

      // Skip if dimensions are invalid (NaN or zero)
      if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
        console.warn('Invalid wall dimensions:', { width, height })
        return
      }

      wallRef.current.style.width = `${width * scaling}px`
      wallRef.current.style.height = `${height * scaling}px`

      setWallWidth(width.toFixed(2))
      setWallHeight(height.toFixed(2))

      const { boundingBox, normal } = boundingData
      const { min, max } = boundingBox

      const x = (min.x + max.x) / 2
      const y = (min.y + max.y) / 2
      const z = (min.z + max.z) / 2

      const wallCoordinates = { x, y, z }
      const wallNormal = { x: normal.x, y: normal.y, z: normal.z }

      dispatch(setWallDimensions({ width, height }))
      dispatch(setWallCoordinates({ coordinates: wallCoordinates, normal: wallNormal }))
    }
  }, [boundingData, dispatch])

  useEffect(() => {
    if (boundingData && currentArtwork) {
      const new3DCoordinate = convert2DTo3D(
        currentArtwork.posX2d,
        currentArtwork.posY2d,
        currentArtwork.width2d,
        currentArtwork.height2d,
        boundingData,
      )

      dispatch(
        updateArtworkPosition({
          artworkId: currentArtworkId ?? '',
          artworkPosition: { ...new3DCoordinate },
        }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArtworkUploaded, dispatch])

  const { handleDeselect } = useDeselectArtwork()

  useEffect(() => {
    const onDocumentClick = (e: MouseEvent) => {
      if (preventClick.current) return

      const target = e.target as Element | null
      if (target && target.closest('[data-no-deselect="true"]')) {
        return
      }

      const wallEl = wallRef.current
      if (!wallEl) return

      if (!wallEl.contains(target as Node)) {
        handleRemoveArtworkGroup()
        handleDeselect()
      }
    }

    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [wallRef, preventClick, handleRemoveArtworkGroup, handleDeselect])

  const handleClickOnWall = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (preventClick.current) {
        e.stopPropagation()
        return
      }
      handleRemoveArtworkGroup()
      handleDeselect()
    },
    [preventClick, handleRemoveArtworkGroup, handleDeselect],
  )

  useKeyboardEvents(currentArtworkId, hoveredArtworkId === currentArtworkId)

  const wallArtworks = useMemo(() => {
    if (!currentWallId) return []
    return allIds
      .map((id) => {
        const artwork = artworksById[id]
        const pos = exhibitionArtworksById[id]
        if (!artwork || !pos) return null
        if (pos.wallId !== currentWallId) return null
        return toRuntimeArtwork(artwork, pos)
      })
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
  }, [allIds, artworksById, exhibitionArtworksById, currentWallId])

  return (
    <div className={styles.wrapper}>
      {wallWidth && wallHeight && <Measurements width={wallWidth} height={wallHeight} />}
      <div
        ref={wallRef}
        className={styles.wall}
        onMouseDown={handleSelectMouseDown}
        onMouseMove={handleSelectMouseMove}
        onMouseUp={(e) => handleSelectMouseUp(e)}
        onClick={handleClickOnWall}
        onDragOver={handleDragArtworkOverWall}
        onDrop={handleDropArtworkOnWall}
      >
        {isHumanVisible && (
          <>
            <Human humanWidth={humanWidth} humanHeight={humanHeight} position="left" />
            <Human humanWidth={humanWidth} humanHeight={humanHeight} position="right" />
          </>
        )}
        {wallArtworks.map((artwork) => (
          <Artwork
            key={artwork.id}
            artwork={artwork}
            onHandleResize={handleResize}
            setHoveredArtworkId={setHoveredArtworkId}
            wallRef={wallRef}
            boundingData={boundingData}
            scaleFactor={scaleFactor}
            preventClick={preventClick}
            groupArtworkHandlers={groupArtworkHandlers}
          />
        ))}

        <DistanceLines />

        {artworkGroupIds.length > 1 && (
          <Group
            wallRef={wallRef}
            boundingData={boundingData}
            scaleFactor={scaleFactor}
            preventClick={preventClick}
            groupArtworkHandlers={groupArtworkHandlers}
          />
        )}
        {selectionBox && <SelectionBox selectionBox={selectionBox} scaleFactor={scaleFactor} />}
        {alignedPairs?.map((pair, index: number) => {
          if (!isDragging && !isDraggingGroup && !isResizing) return null

          // Handle wall center alignment specially (for both single artwork and group)
          if (pair.to === '__wall__' && boundingData) {
            const wallWidth2d = boundingData.width * scaling
            const wallHeight2d = boundingData.height * scaling

            if (pair.direction === 'center-vertical') {
              // Vertical line through wall center
              return (
                <AlignedLine
                  key={index}
                  start={{ x: wallWidth2d / 2, y: 0, width: 0, height: wallHeight2d }}
                  end={{ x: wallWidth2d / 2, y: 0, width: 0, height: wallHeight2d }}
                  direction="center-vertical"
                  color="#ff4444"
                />
              )
            }
            if (pair.direction === 'center-horizontal') {
              // Horizontal line through wall center
              return (
                <AlignedLine
                  key={index}
                  start={{ x: 0, y: wallHeight2d / 2, width: wallWidth2d, height: 0 }}
                  end={{ x: 0, y: wallHeight2d / 2, width: wallWidth2d, height: 0 }}
                  direction="center-horizontal"
                  color="#ff4444"
                />
              )
            }
            return null
          }

          const from = exhibitionArtworksById[pair.from] || {}
          const to = exhibitionArtworksById[pair.to] || {}

          return (
            <AlignedLine
              key={index}
              start={{
                x: from.posX2d,
                y: from.posY2d,
                width: from.width2d,
                height: from.height2d,
              }}
              end={{
                x: to.posX2d,
                y: to.posY2d,
                width: to.width2d,
                height: to.height2d,
              }}
              direction={pair.direction}
            />
          )
        })}
      </div>
    </div>
  )
}
