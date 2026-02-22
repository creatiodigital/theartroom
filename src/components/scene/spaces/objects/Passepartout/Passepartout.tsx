import { RoundedBox } from '@react-three/drei'
import { Material } from 'three'

interface PassepartoutProps {
  width: number
  height: number
  thickness: number // This is the border width, not depth
  depth?: number // Z-depth (how much it protrudes)
  material: Material
}

const BEVEL_RADIUS = 0.001

const Passepartout: React.FC<PassepartoutProps> = ({
  width,
  height,
  thickness,
  depth = 0.02,
  material,
}) => {
  // Passepartout sits ON TOP of the artwork/support, extending forward (positive Z)
  // The back face touches the support surface, mat body extends toward viewer
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

export default Passepartout
