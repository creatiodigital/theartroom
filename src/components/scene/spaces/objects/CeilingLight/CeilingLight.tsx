import { Mesh, BufferGeometry } from 'three'

interface CeilingLightProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const CeilingLight: React.FC<CeilingLightProps> = ({ nodes }) => {
  if (!nodes.ceilingLight0) return null

  return (
    <mesh
      name="ceilingLight0"
      geometry={nodes.ceilingLight0.geometry}
      position={nodes.ceilingLight0.position}
      rotation={nodes.ceilingLight0.rotation}
      scale={nodes.ceilingLight0.scale}
    >
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={30}
        side={2} // DoubleSide
      />
    </mesh>
  )
}

export default CeilingLight
