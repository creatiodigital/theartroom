import { useMemo } from 'react'
import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'

interface SocketsProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  socketCount?: number
  screwCount?: number
}

const Sockets: React.FC<SocketsProps> = ({ nodes, socketCount = 4, screwCount = 4 }) => {
  // Tinted colors that respond to ambient light
  const tintedSocket = useAmbientLightColor('#f5f5f0')
  const tintedScrew = useAmbientLightColor('#a0a0a0')

  const socketsArray = useMemo(() => Array.from({ length: socketCount }), [socketCount])
  const screwsArray = useMemo(() => Array.from({ length: screwCount }), [screwCount])

  return (
    <>
      {/* Sockets */}
      {socketsArray.map((_, i) => {
        const socketNode = nodes[`socket${i}`]
        if (!socketNode) return null
        return (
          <mesh
            key={`socket-${i}`}
            name={`socket${i}`}
            geometry={socketNode.geometry}
            position={socketNode.position}
            rotation={socketNode.rotation}
            scale={socketNode.scale}
          >
            <meshStandardMaterial color={tintedSocket} roughness={0.6} />
          </mesh>
        )
      })}

      {/* Screws */}
      {screwsArray.map((_, i) => {
        const screwNode = nodes[`screw${i}`]
        if (!screwNode) return null
        return (
          <mesh
            key={`screw-${i}`}
            name={`screw${i}`}
            geometry={screwNode.geometry}
            position={screwNode.position}
            rotation={screwNode.rotation}
            scale={screwNode.scale}
          >
            <meshStandardMaterial color={tintedScrew} roughness={0.4} metalness={0.8} />
          </mesh>
        )
      })}
    </>
  )
}

export default Sockets
