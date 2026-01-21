import { Text } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'
import type { ComponentRef } from 'react'
import { DoubleSide } from 'three'

import type { RuntimeArtwork } from '@/utils/artworkTransform'

type StencilProps = {
  artwork: RuntimeArtwork
}

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
  } = artwork

  const fontSizeFactor = 0.01
  // Convert textPadding (pixels) to 3D units
  // Both sides: (padding * 2) / 100 = padding offset in 3D space
  const textPaddingValue = textPadding?.value ?? 12
  const paddingOffset = (textPaddingValue * 2) / 100

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
  } as const

  const resolvedFontFamily = fontFamily?.value ?? 'roboto'
  const resolvedFontWeight = fontWeight?.value ?? 'regular'
  const fontUrl = fontMap[resolvedFontFamily]?.[resolvedFontWeight] ?? fontMap.roboto.regular

  const textRef = useRef<ComponentRef<typeof Text>>(null)
  const [textWidth, setTextWidth] = useState(0)
  const [textHeight, setTextHeight] = useState(0)

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
        return -planeW / 2 + planeW
      case 'right':
        return planeW / 2 - planeW + textWidth
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
        return halfPlane // Position at top of plane
      case 'center':
        return textHeight / 2 // Center based on actual text height
      case 'bottom':
        return -halfPlane + textHeight // Position at bottom
      default:
        return halfPlane
    }
  }

  return (
    <group position={position} quaternion={quaternion}>
      {/* Background plane - shown when textBackgroundColor is set or no text content (placeholder) */}
      {(textBackgroundColor || !textContent) && (
        <mesh renderOrder={1}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial color={textBackgroundColor ?? 'white'} side={DoubleSide} />
        </mesh>
      )}

      {textContent && fontSize?.value && (
        <mesh 
          key={id} 
          renderOrder={2}
          position={[0, getTextYOffset(textVerticalAlign, planeHeight), 0.001]}
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
          >
            {textContent}
          </Text>
        </mesh>
      )}
    </group>
  )
}

export default Stencil
