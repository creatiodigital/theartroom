'use client'

import { Text } from '@react-three/drei'
import { useMemo } from 'react'
import { BoxGeometry } from 'three'

import {
  EDITION_INK_TOP_EM,
  EDITION_NUMBER_CLEARANCE_CM,
  EDITION_NUMBER_FONT_SIZE_CM,
  editionLeftBearingEm,
} from '@/components/PrintWizard/editionNumberMetrics'
import {
  PAPER_BORDER_M,
  PAPER_THICKNESS_M,
  imageSize,
  paperLift,
} from '@/lib/printPresentation/geometry'
import type { Look } from '@/lib/printPresentation/look'

import { ArtworkWindow, type WindowRectPx } from './ArtworkWindow'

/** The pencilled number: a light hand, smaller than the print's own, in soft graphite. */
const PENCIL_SIZE = 0.75
const PENCIL_COLOR = '#a2a3a4'

/**
 * The limited-edition sheet: flat where the image is, its border easing off the wall towards the
 * corners (paper never lies perfectly flat). Its shadow widens and narrows with it.
 */
const usePaperSheet = (iw: number, ih: number, look: Look) => {
  const pw = iw + 2 * PAPER_BORDER_M
  const ph = ih + 2 * PAPER_BORDER_M
  const lift = useMemo(() => paperLift(look, iw, ih), [look, iw, ih])
  const geometry = useMemo(() => {
    const g = new BoxGeometry(pw, ph, PAPER_THICKNESS_M, 120, 120, 1)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + lift(p.getX(i), p.getY(i)))
    g.computeVertexNormals()
    return g
  }, [pw, ph, lift])
  return { geometry, lift }
}

/**
 * A limited edition: the unframed sheet held a few millimetres off the wall, the copy number
 * pencilled bottom left ("copy/N"; no signature).
 */
export const Limited = ({
  ratio,
  edition,
  look,
  onWindow,
  onNumberDrawn,
}: {
  ratio: number
  edition: number
  look: Look
  onWindow: (rect: WindowRectPx) => void
  /** The pencilled number is laid out off the main thread; the shot waits for it. */
  onNumberDrawn: () => void
}) => {
  const [iw, ih] = imageSize(ratio)
  const { geometry, lift } = usePaperSheet(iw, ih, look)
  const front = look.standoff + PAPER_THICKNESS_M
  const label = `${look.copy}/${edition}`
  const fontSize = (EDITION_NUMBER_FONT_SIZE_CM / 100) * PENCIL_SIZE
  const left = -iw / 2 - editionLeftBearingEm(label) * fontSize
  const top = -ih / 2 - EDITION_NUMBER_CLEARANCE_CM / 100 - EDITION_INK_TOP_EM * fontSize
  // The pencil sits on the paper, wherever the paper is there.
  const numberZ = front + lift(left + fontSize, top - fontSize / 2) + 0.0003
  return (
    <group>
      {/* Casts onto the wall but never onto itself: a thin sheet self-shadowing under soft shadows
          leaves a noisy gray band along its lit edges. */}
      <mesh
        geometry={geometry}
        position={[0, 0, look.standoff + PAPER_THICKNESS_M / 2]}
        userData={{ noReceive: true }}
      >
        <meshStandardMaterial color="#f9f8f4" roughness={0.95} />
      </mesh>
      <ArtworkWindow width={iw} height={ih} z={front + 0.0002} onRect={onWindow} />
      <Text
        font="/fonts/caveat-regular.ttf"
        fontSize={fontSize}
        color={PENCIL_COLOR}
        anchorX="left"
        anchorY="top"
        position={[left, top + EDITION_INK_TOP_EM * fontSize, numberZ]}
        material-toneMapped={false}
        userData={{ noShadow: true }}
        onSync={onNumberDrawn}
      >
        {label}
      </Text>
    </group>
  )
}
