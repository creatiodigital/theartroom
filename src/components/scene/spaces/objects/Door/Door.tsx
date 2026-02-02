import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'

interface DoorProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const Door: React.FC<DoorProps> = ({ nodes }) => {
  // Tinted colors that respond to ambient light
  const tintedWhite = useAmbientLightColor('#d8d8d8')
  const tintedMetal = useAmbientLightColor('#d8d8d8')

  return (
    <>
      {/* Door Frame */}
      {nodes.doorFrame0 && (
        <mesh
          name="doorFrame0"
          geometry={nodes.doorFrame0.geometry}
          position={nodes.doorFrame0.position}
          rotation={nodes.doorFrame0.rotation}
          scale={nodes.doorFrame0.scale}
        >
          <meshStandardMaterial color={tintedWhite} roughness={0.8} />
        </mesh>
      )}

      {/* Door Main Panel */}
      {nodes.doorMain0 && (
        <mesh
          name="doorMain0"
          geometry={nodes.doorMain0.geometry}
          position={nodes.doorMain0.position}
          rotation={nodes.doorMain0.rotation}
          scale={nodes.doorMain0.scale}
        >
          <meshStandardMaterial color={tintedWhite} roughness={0.8} />
        </mesh>
      )}

      {/* Door Handle */}
      {nodes.doorHandle0 && (
        <mesh
          name="doorHandle0"
          geometry={nodes.doorHandle0.geometry}
          position={nodes.doorHandle0.position}
          rotation={nodes.doorHandle0.rotation}
          scale={nodes.doorHandle0.scale}
        >
          <meshStandardMaterial color={tintedMetal} roughness={0.2} metalness={1.0} />
        </mesh>
      )}

      {/* Door Hinge */}
      {nodes.doorHinge0 && (
        <mesh
          name="doorHinge0"
          geometry={nodes.doorHinge0.geometry}
          position={nodes.doorHinge0.position}
          rotation={nodes.doorHinge0.rotation}
          scale={nodes.doorHinge0.scale}
        >
          <meshStandardMaterial color={tintedMetal} roughness={0.2} metalness={1.0} />
        </mesh>
      )}
    </>
  )
}

export default Door
