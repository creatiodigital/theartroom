import { useMemo, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Mesh,
  BufferGeometry,
  DoubleSide,
  Vector3,
  SpotLight,
  MeshStandardMaterial,
} from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'

interface RoundLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0


/**
 * Round lamp using <primitive> to preserve Blender hierarchy (body → bulb).
 * Body position is the Blender origin. Bulb has a small local Y offset.
 * Materials are applied imperatively.
 * Reuses the recessed lamp color/intensity controls.
 */
const RoundLamp: React.FC<RoundLampProps> = ({ nodes, count = 17 }) => {
  const tintedPlastic = useAmbientLightColor('#ffffff')

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const bulbEmissiveIntensity = lampIntensity
  const lampAngle = useSelector(
    (state: RootState) => state.exhibition.recessedLampAngle ?? 0.45,
  )
  const lampDistance = useSelector(
    (state: RootState) => state.exhibition.recessedLampDistance ?? 15,
  )

  // Apply materials imperatively (required when using <primitive>)
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const bodyNode = nodes[`roundLampBody${i}`]
      const bulbNode = nodes[`roundLampBulb${i}`]

      if (bodyNode) {
        bodyNode.material = new MeshStandardMaterial({
          color: tintedPlastic,
          roughness: 0.4,
          metalness: 0.0,
        })
      }

      if (bulbNode) {
        bulbNode.material = new MeshStandardMaterial({
          color: '#000000',
          emissive: lampColor,
          emissiveIntensity: bulbEmissiveIntensity,
          toneMapped: false,
          side: DoubleSide,
        })
      }
    }
  }, [nodes, count, tintedPlastic, lampColor, bulbEmissiveIntensity])

  // Compute world-space bulb positions for spotlight placement
  const bulbPositions = useMemo(() => {
    const positions: Vector3[] = []
    for (let i = 0; i < count; i++) {
      const bodyNode = nodes[`roundLampBody${i}`]
      const bulbNode = nodes[`roundLampBulb${i}`]

      if (bodyNode && bulbNode) {
        bodyNode.updateWorldMatrix(true, true)
        const worldPos = new Vector3()
        bulbNode.getWorldPosition(worldPos)
        positions.push(worldPos)
      } else if (bodyNode) {
        positions.push(new Vector3(bodyNode.position.x, bodyNode.position.y, bodyNode.position.z))
      } else {
        positions.push(new Vector3())
      }
    }
    return positions
  }, [nodes, count])

  const lampsArray = useMemo(() => Array.from({ length: count }), [count])


  return (
    <>
      {lampsArray.map((_, i) => {
        const bodyNode = nodes[`roundLampBody${i}`]
        if (!bodyNode) return null

        const bulbPos = bulbPositions[i]

        return (
          <group key={`roundLamp-${i}`}>
            {/* Primitive preserves: body (with position) → bulb (with local offset) */}
            <primitive object={bodyNode} />

            {/* Per-lamp downward spotlight — no track lamps in plafond-only mode */}
            <object3D position={[bulbPos.x, bulbPos.y - 10, bulbPos.z]} ref={(obj) => {
              if (obj) {
                const light = obj.parent?.children.find(
                  (c) => c.type === 'SpotLight'
                ) as SpotLight | undefined
                if (light) light.target = obj
              }
            }} />
            <spotLight
              position={[bulbPos.x, bulbPos.y, bulbPos.z]}
              color={lampColor}
              intensity={lampIntensity * 2}
              angle={lampAngle}
              penumbra={1}
              distance={lampDistance}
              decay={2}
              castShadow={false}
            />
          </group>
        )
      })}
    </>
  )
}

export default RoundLamp
