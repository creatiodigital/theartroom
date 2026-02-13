import { Material } from 'three'

interface FrameProps {
  width: number
  height: number
  thickness: number // Border width (XY)
  depth?: number // Z-depth (how much it protrudes)
  material: Material
}

const Frame: React.FC<FrameProps> = ({ width, height, thickness, depth = 0.01, material }) => {
  // Frame extends forward from the wall (positive Z direction)
  // Both frame and support start at Z=0 (wall), frame protrudes toward viewer
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

export default Frame
