import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'

interface RadiatorProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const Radiator: React.FC<RadiatorProps> = ({ nodes }) => {
  // Tinted color that responds to ambient light
  const tintedColor = useAmbientLightColor('#e8e8e8')

  if (!nodes.radiator0) return null

  return (
    <mesh
      name="radiator0"
      geometry={nodes.radiator0.geometry}
      position={nodes.radiator0.position}
      rotation={nodes.radiator0.rotation}
      scale={nodes.radiator0.scale}
    >
      <meshStandardMaterial color={tintedColor} roughness={0.5} />
    </mesh>
  )
}

export default Radiator
