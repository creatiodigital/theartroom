import { Material } from 'three'

interface FrameProps {
  width: number
  height: number
  thickness: number
  material: Material
  depth?: number
}

const Frame: React.FC<FrameProps> = ({ width, height, thickness, material, depth = 0.03 }) => {
  // Frame protrudes forward from the wall to create shadows
  const frameDepth = Math.max(thickness, depth)
  
  return (
    <group position={[0, 0, frameDepth / 2]}>
      {/* Left side */}
      <mesh castShadow receiveShadow position={[-(width / 2 - thickness / 2), 0, 0]}>
        <boxGeometry args={[thickness, height, frameDepth]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Right side */}
      <mesh castShadow receiveShadow position={[width / 2 - thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height, frameDepth]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Top side */}
      <mesh castShadow receiveShadow position={[0, height / 2 - thickness / 2, 0]}>
        <boxGeometry args={[width, thickness, frameDepth]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Bottom side */}
      <mesh castShadow receiveShadow position={[0, -(height / 2 - thickness / 2), 0]}>
        <boxGeometry args={[width, thickness, frameDepth]} />
        <primitive attach="material" object={material} />
      </mesh>
    </group>
  )
}

export default Frame
