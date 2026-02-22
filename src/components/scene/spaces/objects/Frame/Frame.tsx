import { RoundedBox } from '@react-three/drei'
import { Material } from 'three'

interface FrameProps {
  width: number
  height: number
  thickness: number // Border width (XY)
  depth?: number // Z-depth (how much it protrudes)
  material: Material
}

const BEVEL_RADIUS = 0.002

const Frame: React.FC<FrameProps> = ({ width, height, thickness, depth = 0.01, material }) => {
  // Frame extends forward from the wall (positive Z direction)
  // Both frame and support start at Z=0 (wall), frame protrudes toward viewer
  const zOffset = depth / 2

  return (
    <group position={[0, 0, zOffset]}>
      {/* Left side */}
      <RoundedBox
        args={[thickness, height, depth]}
        radius={BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[-(width / 2 - thickness / 2), 0, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>

      {/* Right side */}
      <RoundedBox
        args={[thickness, height, depth]}
        radius={BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[width / 2 - thickness / 2, 0, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>

      {/* Top side */}
      <RoundedBox
        args={[width, thickness, depth]}
        radius={BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[0, height / 2 - thickness / 2, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>

      {/* Bottom side */}
      <RoundedBox
        args={[width, thickness, depth]}
        radius={BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[0, -(height / 2 - thickness / 2), 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
    </group>
  )
}

export default Frame
