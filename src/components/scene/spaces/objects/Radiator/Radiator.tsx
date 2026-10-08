import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry } from 'three'
import type { RootState } from '@/redux/store'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import { countNodes } from '@/components/scene/spaces/objects/nodeIndices'

// The off-white every radiator had before the color became editable.
export const DEFAULT_RADIATOR_COLOR = '#e8e8e8'

interface RadiatorProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
  radiatorRef?: React.Ref<Mesh>
}

const Radiator: React.FC<RadiatorProps> = ({ nodes, count, radiatorRef }) => {
  // Count comes from the GLB unless a space deliberately overrides it, so a
  // bigger space needs no code change to show all of its props.
  const resolvedCount = count ?? countNodes(nodes, 'radiator')
  const radiatorColor = useSelector(
    (state: RootState) => state.exhibition.radiatorColor ?? DEFAULT_RADIATOR_COLOR,
  )
  // Tinted color that responds to ambient light
  const tintedColor = useAmbientLightColor(radiatorColor)

  const indices = useMemo(() => Array.from({ length: resolvedCount }, (_, i) => i), [resolvedCount])

  return (
    <>
      {indices.map((i) => {
        const node = nodes[`radiator${i}`]
        if (!node) return null
        return (
          <mesh
            key={`radiator-${i}`}
            ref={i === 0 ? radiatorRef : undefined}
            name={`radiator${i}`}
            geometry={node.geometry}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
          >
            <meshStandardMaterial color={tintedColor} roughness={0.5} />
          </mesh>
        )
      })}
    </>
  )
}

export default Radiator
