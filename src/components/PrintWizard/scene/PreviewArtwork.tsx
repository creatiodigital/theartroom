'use client'

import { useMemo } from 'react'
import { MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three'
import { useLoader } from '@react-three/fiber'

import Frame from '@/components/scene/spaces/objects/Frame/Frame'

import {
  type Catalog,
  type WizardConfig,
  collectVisualHints,
  getEffectiveBorderCm,
  getEffectiveMatCm,
  getEffectiveSizeCm,
} from '@/lib/print-providers'

interface PreviewArtworkProps {
  imageUrl: string
  catalog: Catalog
  config: WizardConfig
  /** Pixel aspect ratio of the artwork. > 1 = landscape → size swaps. */
  imageAspectRatio: number
}

const ARTWORK_Z = 0.012

// Sane fallbacks if the catalog's option visuals don't carry a hint.
const DEFAULT_MOULDING_WIDTH_CM = 2.0
const DEFAULT_MOULDING_DEPTH_CM = 2.2
const DEFAULT_FRAME_HEX = '#0b0b0b'
const DEFAULT_FRAME_ROUGHNESS = 0.4
const DEFAULT_PAPER_ROUGHNESS = 0.7
const DEFAULT_MAT_HEX = '#f6f3ec'

export const PreviewArtwork = ({
  imageUrl,
  catalog,
  config,
  imageAspectRatio,
}: PreviewArtworkProps) => {
  // Hooks must be called unconditionally on every render. Anything we
  // need before the `effectiveSize` early-return below has to be
  // computed and hooked-into here, otherwise React's hook order
  // shifts when `effectiveSize` flips between null and not-null and
  // state corrupts.
  const visuals = collectVisualHints(catalog, config)
  const displayIsLandscape = config.values.orientation === 'landscape'
  const imageIsLandscape = imageAspectRatio > 1
  const textureNeedsRotation = imageIsLandscape !== displayIsLandscape

  const frameHex = visuals.frameColorHex ?? DEFAULT_FRAME_HEX
  const frameRoughness = visuals.frameRoughness ?? DEFAULT_FRAME_ROUGHNESS

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

  const frameMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: frameHex,
        roughness: frameRoughness,
        metalness: 0.05,
      }),
    [frameHex, frameRoughness],
  )

  // Now safe to bail out early — every hook above has fired.
  const effectiveSize = getEffectiveSizeCm(catalog, config)
  if (!effectiveSize) return null

  const borderCm = getEffectiveBorderCm(config, 'border')
  const matCm = getEffectiveMatCm(catalog, config)

  const framed = visuals.framed === true
  const matBorderM = framed && matCm > 0 ? matCm / 100 : 0
  const paperBorderM = borderCm / 100
  const mouldingWidthM = (visuals.mouldingWidthCm ?? DEFAULT_MOULDING_WIDTH_CM) / 100
  const mouldingDepthM = (visuals.mouldingDepthCm ?? DEFAULT_MOULDING_DEPTH_CM) / 100
  const paperRoughness = visuals.paperRoughness ?? DEFAULT_PAPER_ROUGHNESS
  const matHex = visuals.matColorHex ?? DEFAULT_MAT_HEX

  // Sizes are declared portrait. The frame follows the buyer's chosen
  // orientation — flip width/height when they pick landscape.
  const widthM = (displayIsLandscape ? effectiveSize.heightCm : effectiveSize.widthCm) / 100
  const heightM = (displayIsLandscape ? effectiveSize.widthCm : effectiveSize.heightCm) / 100

  // White paper border (TPS) wraps the printed image on the same
  // sheet — sits behind the print and reads as paper, not mat.
  const paperWidthM = widthM + paperBorderM * 2
  const paperHeightM = heightM + paperBorderM * 2

  // Passepartout (mount) sits between the paper and the frame.
  const matWidthM = paperWidthM + matBorderM * 2
  const matHeightM = paperHeightM + matBorderM * 2

  return (
    <group position={[0, 0, ARTWORK_Z]}>
      {framed && matBorderM > 0 && (
        <mesh position={[0, 0, -0.0015]}>
          <planeGeometry args={[matWidthM, matHeightM]} />
          <meshStandardMaterial color={matHex} roughness={0.95} />
        </mesh>
      )}

      {paperBorderM > 0 && (
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[paperWidthM, paperHeightM]} />
          <meshStandardMaterial color="#ffffff" roughness={paperRoughness} />
        </mesh>
      )}

      <mesh>
        <planeGeometry args={[widthM, heightM]} />
        <meshStandardMaterial map={texture} roughness={paperRoughness} />
      </mesh>

      {framed && (
        <group position={[0, 0, -0.002]}>
          <Frame
            width={matWidthM + mouldingWidthM * 2}
            height={matHeightM + mouldingWidthM * 2}
            thickness={mouldingWidthM}
            depth={mouldingDepthM}
            material={frameMaterial}
            cornerStyle="mitered"
          />
        </group>
      )}
    </group>
  )
}
