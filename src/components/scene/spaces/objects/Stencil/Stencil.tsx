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
    textColor,
    fontSize,
    lineHeight,
    fontWeight,
    fontFamily,
    letterSpacing,
  } = artwork

  const fontSizeFactor = 0.01
  // 2D CSS has padding: 10px, so we need to subtract 20px (both sides) from width
  // In 3D units: 20px / 100 = 0.2
  const paddingOffset = 0.2

  const fontMap = {
    roboto: {
      regular: '/fonts/roboto-regular.ttf',
      bold: '/fonts/roboto-bold.ttf',
    },
    lora: {
      regular: '/fonts/lora-regular.ttf',
      bold: '/fonts/lora-bold.ttf',
    },
  } as const

  const resolvedFontFamily = fontFamily?.value ?? 'roboto'
  const resolvedFontWeight = fontWeight?.value ?? 'regular'
  const fontUrl = fontMap[resolvedFontFamily][resolvedFontWeight]

  const textRef = useRef<ComponentRef<typeof Text>>(null)
  const [textWidth, setTextWidth] = useState(0)

  const calculateTextWidth = () => {
    if (textRef.current) {
      const geometry = textRef.current.geometry
      geometry.computeBoundingBox()
      const boundingBox = geometry.boundingBox
      if (boundingBox) {
        const width = boundingBox.max.x - boundingBox.min.x
        setTextWidth(width > 0 ? width : 0)
      }
    }
  }

  useEffect(() => {
    if (textRef.current) {
      textRef.current.sync()
      calculateTextWidth()
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

  const getAnchorY = (planeH: number): number => {
    return planeH / 2 - planeH
  }

  return (
    <group position={position} quaternion={quaternion}>
      {!textContent && (
        <mesh renderOrder={1}>
          <planeGeometry args={[planeWidth, planeHeight]} />
          <meshBasicMaterial color="white" side={DoubleSide} />
        </mesh>
      )}

      {textContent && fontSize?.value && (
        <mesh key={id} renderOrder={2}>
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
            anchorY={getAnchorY(height ?? 1)}
            maxWidth={(width ?? 0) - paddingOffset}
            textAlign={textAlign ?? 'left'}
            whiteSpace="normal"
            overflowWrap="break-word"
            onSync={calculateTextWidth}
          >
            {textContent}
          </Text>
        </mesh>
      )}
    </group>
  )
}

export default Stencil
