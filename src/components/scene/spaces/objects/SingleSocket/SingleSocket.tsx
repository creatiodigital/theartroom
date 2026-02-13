import { useMemo } from 'react'
import { Mesh, BufferGeometry } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'

interface SingleSocketProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

/**
 * Single socket (wall power outlet).
 * Iterates over indexed meshes: singleSocket0, singleSocket1, etc.
 */
const SingleSocket: React.FC<SingleSocketProps> = ({ nodes, count = 2 }) => {
  const tintedPlastic = useAmbientLightColor('#d8d8d8')

  const socketsArray = useMemo(() => Array.from({ length: count }), [count])

  return (
    <>
      {socketsArray.map((_, i) => {
        const socketNode = nodes[`singleSocket${i}`]
        if (!socketNode) return null
        return (
          <mesh key={`singleSocket-${i}`} name={`singleSocket${i}`} geometry={socketNode.geometry}>
            <meshStandardMaterial color={tintedPlastic} roughness={0.9} metalness={0.0} />
          </mesh>
        )
      })}
    </>
  )
}

export default SingleSocket
