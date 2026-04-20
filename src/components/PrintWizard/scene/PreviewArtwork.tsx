'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { useLoader } from '@react-three/fiber'

import Frame from '@/components/scene/spaces/objects/Frame/Frame'

import { getFormat, getFrameColor, getMount, getPaper, getSize } from '../options'
import type { PrintConfig } from '../types'

interface PreviewArtworkProps {
  imageUrl: string
  config: PrintConfig
  /** Pixel aspect ratio of the artwork. > 1 = landscape → size swaps. */
  imageAspectRatio: number
}

const ARTWORK_Z = 0.012

// Physical dimensions of the Prodigi Classic frame moulding. Box frame gets
// an extra depth bump. Keep these in sync with the real product if it changes.
const CLASSIC_MOULDING_CM = { width: 2.0, depth: 2.2 }
const BOX_EXTRA_DEPTH_CM = 2.5

export const PreviewArtwork = ({ imageUrl, config, imageAspectRatio }: PreviewArtworkProps) => {
  const size = getSize(config.sizeId)
  const format = getFormat(config.formatId)
  const frameColor = getFrameColor(config.frameColorId)
  const mount = getMount(config.mountId)
  const paper = getPaper(config.paperId)

  // SIZES are declared portrait (width < height). The frame follows the
  // *buyer's chosen orientation* — when they flip to landscape we swap
  // width/height so the preview matches how the print will be hung. This
  // is the same flip the SKU size expresses at checkout (Prodigi's product
  // area rotates with the sizing/orientation pair).
  const displayIsLandscape = config.orientation === 'landscape'
  const widthM = (displayIsLandscape ? size.heightCm : size.widthCm) / 100
  const heightM = (displayIsLandscape ? size.widthCm : size.heightCm) / 100
  const matBorderM = format.framed ? mount.borderCm / 100 : 0
  const matWidthM = widthM + matBorderM * 2
  const matHeightM = heightM + matBorderM * 2

  // If the image's natural orientation doesn't match the chosen orientation,
  // rotate the texture 90° so it fills the plane without being stretched —
  // mirrors Prodigi's auto-rotation at fulfilment time.
  const imageIsLandscape = imageAspectRatio > 1
  const textureNeedsRotation = imageIsLandscape !== displayIsLandscape

  const texture = useLoader(TextureLoader, imageUrl)
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
    texture.center.set(0.5, 0.5)
    texture.rotation = textureNeedsRotation ? Math.PI / 2 : 0
    texture.needsUpdate = true
  }, [texture, textureNeedsRotation])

  const frameMaterial = useMemo(() => {
    return new MeshStandardMaterial({
      color: frameColor.hex,
      roughness: frameColor.roughness,
      metalness: 0.05,
    })
  }, [frameColor.hex, frameColor.roughness])

  // Matte cotton for Museum Cotton Rag, slightly less so for Fine Art Matte.
  const paperRoughness = paper.id === 'museum-cotton-rag' ? 0.85 : 0.7

  const frameDepthM =
    (CLASSIC_MOULDING_CM.depth + (config.formatId === 'box-framed' ? BOX_EXTRA_DEPTH_CM : 0)) / 100

  return (
    <group position={[0, 0, ARTWORK_Z]}>
      {format.framed && matBorderM > 0 && (
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[matWidthM, matHeightM]} />
          <meshStandardMaterial color="#f6f3ec" roughness={0.95} />
        </mesh>
      )}

      <mesh>
        <planeGeometry args={[widthM, heightM]} />
        <meshStandardMaterial map={texture} roughness={paperRoughness} />
      </mesh>

      {format.framed && (
        <group position={[0, 0, -0.002]}>
          <Frame
            width={matWidthM + (CLASSIC_MOULDING_CM.width / 100) * 2}
            height={matHeightM + (CLASSIC_MOULDING_CM.width / 100) * 2}
            thickness={CLASSIC_MOULDING_CM.width / 100}
            depth={frameDepthM}
            material={frameMaterial}
            cornerStyle="mitered"
          />
        </group>
      )}
    </group>
  )
}
