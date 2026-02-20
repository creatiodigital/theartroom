import { Text } from '@react-three/drei'
import { WALL_SCALE } from '@/components/wallview/constants'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { ComponentRef } from 'react'
import { DoubleSide, Vector3, Quaternion } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { useDispatch, useSelector } from 'react-redux'

import { showArtworkPanel } from '@/redux/slices/dashboardSlice'
import { setCurrentArtwork, setFocusTarget } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { RuntimeArtwork } from '@/utils/artworkTransform'

type StencilProps = {
  artwork: RuntimeArtwork
}

// Constants for click detection
const CLICK_MAX_DISTANCE = 5
const CLICK_MAX_DURATION = 300
const DOUBLE_CLICK_DELAY = 250

const Stencil = ({ artwork }: StencilProps) => {
  const {
    id,
    position,
    quaternion,
    width,
    height,
    textContent,
    textAlign,
    textVerticalAlign,
    textColor,
    textBackgroundColor,
    fontSize,
    lineHeight,
    fontWeight,
    fontFamily,
    letterSpacing,
    textPadding,
    textThickness,
    showArtworkInformation,
  } = artwork

  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const isArtworkPanelOpen = useSelector((state: RootState) => state.dashboard.isArtworkPanelOpen)
  const dispatch = useDispatch()

  // Refs for click detection
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const pointerDownTime = useRef<number>(0)
  const singleClickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Calculate the normal vector from artwork's quaternion (facing direction)
  const getNormalFromQuaternion = useCallback((q: Quaternion): Vector3 => {
    const normal = new Vector3(0, 0, 1)
    normal.applyQuaternion(q)
    return normal
  }, [])

  // Handle single click for focus
  const handleSingleClick = useCallback(() => {
    if (!isPlaceholdersShown && quaternion && position) {
      const normal = getNormalFromQuaternion(quaternion)
      dispatch(
        setFocusTarget({
          artworkId: artwork.id,
          position: { x: position.x, y: position.y, z: position.z },
          normal: { x: normal.x, y: normal.y, z: normal.z },
          width: width || 1,
          height: height || 1,
        }),
      )

      if (isArtworkPanelOpen) {
        dispatch(setCurrentArtwork(artwork.id))
      }
    }
  }, [
    dispatch,
    artwork.id,
    position,
    quaternion,
    width,
    height,
    isPlaceholdersShown,
    isArtworkPanelOpen,
    getNormalFromQuaternion,
  ])

  // Handle double click for info panel
  const handleDoubleClick = useCallback(() => {
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }

    if (!isPlaceholdersShown && showArtworkInformation) {
      dispatch(showArtworkPanel())
      dispatch(setCurrentArtwork(artwork.id))
    }
  }, [dispatch, artwork.id, isPlaceholdersShown, showArtworkInformation])

  // Pointer down
  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    if (singleClickTimeout.current) {
      clearTimeout(singleClickTimeout.current)
      singleClickTimeout.current = null
    }
    pointerDownPos.current = { x: event.clientX, y: event.clientY }
    pointerDownTime.current = Date.now()
  }, [])

  // Pointer up
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!pointerDownPos.current) return

      const dx = event.clientX - pointerDownPos.current.x
      const dy = event.clientY - pointerDownPos.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const duration = Date.now() - pointerDownTime.current

      pointerDownPos.current = null

      if (distance < CLICK_MAX_DISTANCE && duration < CLICK_MAX_DURATION) {
        singleClickTimeout.current = setTimeout(() => {
          handleSingleClick()
          singleClickTimeout.current = null
        }, DOUBLE_CLICK_DELAY)
      }
    },
    [handleSingleClick],
  )

  // Font size maps to pixels in the 2D wall view.
  // At WALL_SCALE pixels per meter, fontSize N → N/WALL_SCALE meters.
  const fontSizeFactor = 1 / WALL_SCALE
  // Convert textPadding (pixels) to 3D units using the same scale factor as fontSize
  const textPaddingValue = textPadding?.value ?? 0
  const padding3D = textPaddingValue * fontSizeFactor
  const paddingOffset = padding3D * 2  // total padding on both sides

  const fontMap = {
    roboto: {
      regular: '/fonts/roboto-regular.ttf',
      bold: '/fonts/roboto-bold.ttf',
    },
    lora: {
      regular: '/fonts/lora-regular.ttf',
      bold: '/fonts/lora-bold.ttf',
    },
    lato: {
      regular: '/fonts/Lato-Regular.ttf',
      bold: '/fonts/Lato-Bold.ttf',
    },
    'eb-garamond': {
      regular: '/fonts/EBGaramond-Regular.ttf',
      bold: '/fonts/EBGaramond-Bold.ttf',
    },
    geist: {
      regular: '/fonts/Geist-Regular.ttf',
      bold: '/fonts/Geist-Bold.ttf',
    },
    'playfair-display': {
      regular: '/fonts/PlayfairDisplay-Regular.ttf',
      bold: '/fonts/PlayfairDisplay-Bold.ttf',
    },
  } as const

  const resolvedFontFamily = fontFamily?.value ?? 'roboto'
  const resolvedFontWeight = fontWeight?.value ?? 'regular'
  const fontUrl = fontMap[resolvedFontFamily]?.[resolvedFontWeight] ?? fontMap.roboto.regular

  const textRef = useRef<ComponentRef<typeof Text>>(null)
  const [textWidth, setTextWidth] = useState(0)
  const [textHeight, setTextHeight] = useState(0)
  const [fontReady, setFontReady] = useState(false)

  const calculateTextDimensions = () => {
    if (textRef.current) {
      const geometry = textRef.current.geometry
      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      if (boundingBox) {
        const w = boundingBox.max.x - boundingBox.min.x
        const h = boundingBox.max.y - boundingBox.min.y
        setTextWidth(w > 0 ? w : 0)
        setTextHeight(h > 0 ? h : 0)
      }
    }
    // Font is loaded and text is laid out — safe to show
    setFontReady(true)
  }

  useEffect(() => {
    if (textRef.current) {
      textRef.current.sync()
      calculateTextDimensions()
    }
  }, [textContent])

  const planeWidth = width || 1
  const planeHeight = height || 1

  const getAnchorX = (align: typeof textAlign, planeW: number): number => {
    switch (align) {
      case 'left':
      case 'justify':
        return -planeW / 2 + planeW - padding3D
      case 'right':
        return planeW / 2 - planeW + textWidth + padding3D
      case 'center':
        return textWidth / 2
      default:
        return 0
    }
  }

  // Calculate vertical position offset based on alignment
  // The text is anchored at 'top' and we offset its Y position
  const getTextYOffset = (vAlign: typeof textVerticalAlign, planeH: number): number => {
    const halfPlane = planeH / 2
    switch (vAlign) {
      case 'top':
        return halfPlane - padding3D // Position at top of plane, inset by padding
      case 'center':
        return textHeight / 2 // Center based on actual text height
      case 'bottom':
        return -halfPlane + textHeight + padding3D // Position at bottom, inset by padding
      default:
        return halfPlane - padding3D
    }
  }

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Background - box with depth when textThickness > 0, flat plane otherwise */}
      {(textBackgroundColor || !textContent) && (() => {
        const cardDepth = Math.min(10, Math.max(0, textThickness?.value ?? 0)) / 100
        if (cardDepth > 0) {
          return (
            <mesh renderOrder={1} position={[0, 0, -cardDepth / 2]}>
              <boxGeometry args={[planeWidth, planeHeight, cardDepth]} />
              <meshStandardMaterial color={textBackgroundColor ?? 'white'} roughness={1.0} />
            </mesh>
          )
        }
        return (
          <mesh renderOrder={1}>
            <planeGeometry args={[planeWidth, planeHeight]} />
            <meshBasicMaterial color={textBackgroundColor ?? 'white'} side={DoubleSide} />
          </mesh>
        )
      })()}

      {textContent && fontSize?.value && (
        <mesh
          key={id}
          renderOrder={2}
          position={[0, getTextYOffset(textVerticalAlign, planeHeight), 0.001]}
          visible={fontReady}
        >
          <Text
            ref={textRef}
            fontSize={fontSize.value * fontSizeFactor}
            lineHeight={lineHeight?.value ?? 1}
            letterSpacing={
              letterSpacing?.value && fontSize?.value ? letterSpacing.value / fontSize.value : 0
            }
            color={textColor ?? 'black'}
            font={fontUrl}
            anchorX={getAnchorX(textAlign, width ?? 1)}
            anchorY="top"
            maxWidth={(width ?? 0) - paddingOffset}
            textAlign={textAlign ?? 'left'}
            whiteSpace="normal"
            overflowWrap="break-word"
            onSync={calculateTextDimensions}
            sdfGlyphSize={512}
            outlineWidth="1%"
            outlineColor={textColor ?? 'black'}
          >
            {textContent}
          </Text>
        </mesh>
      )}
    </group>
  )
}

export default Stencil
