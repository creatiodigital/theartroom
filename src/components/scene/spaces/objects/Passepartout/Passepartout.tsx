import { useMemo } from 'react'
import type { Material } from 'three'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

import { createPassepartoutPiece } from './passepartoutGeometry'

interface PassepartoutProps {
  width: number
  height: number
  thickness: number // This is the border width, not depth
  depth?: number // Z-depth (how much it protrudes)
  /** The bevel, edges and back — and the front face too unless `faceMaterial` is given. */
  material: Material
  /** The front face alone (AR-165: in the baked look it shows exactly its color, like the image). */
  faceMaterial?: Material
}

/** The four strips: where each sits and how it turns (the top strip's window faces −y). */
const STRIPS = [
  { key: 'top', horizontal: true, at: [0, 1], rotation: 0 },
  { key: 'bottom', horizontal: true, at: [0, -1], rotation: Math.PI },
  { key: 'right', horizontal: false, at: [1, 0], rotation: -Math.PI / 2 },
  { key: 'left', horizontal: false, at: [-1, 0], rotation: Math.PI / 2 },
] as const

const Passepartout: React.FC<PassepartoutProps> = ({
  width,
  height,
  thickness,
  depth = 0.02,
  material,
  faceMaterial,
}) => {
  // Passepartout sits ON TOP of the artwork/support, extending forward (positive Z)
  // The back face touches the support surface, mat body extends toward viewer
  const zOffset = depth / 2

  // Mitered strips with the window cut at 45°, like a real passepartout (`passepartoutGeometry`).
  const horizontal = useMemo(
    () => createPassepartoutPiece(width, thickness, depth),
    [width, thickness, depth],
  )
  const vertical = useMemo(
    () => createPassepartoutPiece(height, thickness, depth),
    [height, thickness, depth],
  )
  useDisposable(horizontal.face)
  useDisposable(horizontal.body)
  useDisposable(vertical.face)
  useDisposable(vertical.body)

  return (
    <group position={[0, 0, zOffset]}>
      {STRIPS.map(({ key, horizontal: isHorizontal, at, rotation }) => {
        const piece = isHorizontal ? horizontal : vertical
        return (
          <group
            key={key}
            position={[(at[0] * width) / 2, (at[1] * height) / 2, 0]}
            rotation={[0, 0, rotation]}
          >
            <mesh geometry={piece.body} material={material} castShadow receiveShadow />
            <mesh
              geometry={piece.face}
              material={faceMaterial ?? material}
              castShadow
              receiveShadow
            />
          </group>
        )
      })}
    </group>
  )
}

export default Passepartout
