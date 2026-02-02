import { Material } from 'three'

interface PassepartoutProps {
  width: number
  height: number
  thickness: number  // This is the border width, not depth
  depth?: number     // Z-depth (how much it protrudes)
  material: Material
}

const Passepartout: React.FC<PassepartoutProps> = ({ width, height, thickness, depth = 0.02, material }) => {
  // Passepartout sits ON TOP of the artwork/support, extending forward (positive Z)
  // The back face touches the support surface, mat body extends toward viewer
  const zOffset = depth / 2

  return (
    <group position={[0, 0, zOffset]}>
      {/* Left side */}
      <mesh castShadow receiveShadow position={[-(width / 2 - thickness / 2), 0, 0]}>
        <boxGeometry args={[thickness, height, depth]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Right side */}
      <mesh castShadow receiveShadow position={[width / 2 - thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height, depth]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Top side */}
      <mesh castShadow receiveShadow position={[0, height / 2 - thickness / 2, 0]}>
        <boxGeometry args={[width, thickness, depth]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Bottom side */}
      <mesh castShadow receiveShadow position={[0, -(height / 2 - thickness / 2), 0]}>
        <boxGeometry args={[width, thickness, depth]} />
        <primitive attach="material" object={material} />
      </mesh>
    </group>
  )
}

export default Passepartout
