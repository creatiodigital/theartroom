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

  // SIZES are declared portrait (width < height). If the artwork is
  // landscape, flip so the rendered plane matches the printed orientation.
  const isLandscape = imageAspectRatio > 1
  const widthM = (isLandscape ? size.heightCm : size.widthCm) / 100
  const heightM = (isLandscape ? size.widthCm : size.heightCm) / 100
  const matBorderM = format.framed ? mount.borderCm / 100 : 0
  const matWidthM = widthM + matBorderM * 2
  const matHeightM = heightM + matBorderM * 2

  const texture = useLoader(TextureLoader, imageUrl)
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.anisotropy = 8
  }, [texture])

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
