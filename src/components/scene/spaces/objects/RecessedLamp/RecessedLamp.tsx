import { useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Mesh,
  BufferGeometry,
  DoubleSide,
  Vector3,
  Object3D,
  SpotLight,
  MeshStandardMaterial,
} from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'

interface RecessedLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
  indices?: number[]
  disableSpotlights?: boolean
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

/**
 * Individual spotlight component for a recessed lamp.
 * Uses an Object3D target positioned below the bulb.
 */
const RecessedSpotlight: React.FC<{
  position: Vector3
  color: string
  intensity: number
}> = ({ position, color, intensity }) => {
  const lightRef = useRef<SpotLight>(null)
  const targetRef = useRef<Object3D>(null)

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current
    }
  }, [])

  return (
    <>
      <object3D ref={targetRef} position={[position.x, position.y - 5, position.z]} />
      <spotLight
        ref={lightRef}
        position={[position.x, position.y, position.z]}
        color={color}
        intensity={intensity}
        angle={Math.PI / 4}
        penumbra={0.8}
        distance={8}
        decay={2}
        castShadow={false}
      />
    </>
  )
}

/**
 * Recessed lamp using <primitive> to preserve Blender hierarchy (body → bulb).
 * Body position is the Blender origin. Bulb has a small local Y offset.
 * Materials are applied imperatively.
 *
 * Supports non-sequential indices via the `indices` prop.
 */
const RecessedLamp: React.FC<RecessedLampProps> = ({
  nodes,
  count = 6,
  indices,
  disableSpotlights = false,
}) => {
  const tintedPlastic = useAmbientLightColor('#ffffff')

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const bulbEmissiveIntensity = 2

  // Resolve which indices to render — explicit list or sequential fallback
  const lampIndices = useMemo(
    () => indices ?? Array.from({ length: count }, (_, i) => i),
    [indices, count],
  )

  // Apply materials imperatively (required when using <primitive>)
  useEffect(() => {
    for (const i of lampIndices) {
      const bodyNode = nodes[`recessedLampBody${i}`]
      const bulbNode = nodes[`recessedLampBulb${i}`]

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
  }, [nodes, lampIndices, tintedPlastic, lampColor, bulbEmissiveIntensity])

  // Compute world-space bulb positions for spotlight placement
  const bulbPositions = useMemo(() => {
    const posMap = new Map<number, Vector3>()
    for (const i of lampIndices) {
      const bodyNode = nodes[`recessedLampBody${i}`]
      const bulbNode = nodes[`recessedLampBulb${i}`]

      if (bodyNode && bulbNode) {
        bodyNode.updateWorldMatrix(true, true)
        const worldPos = new Vector3()
        bulbNode.getWorldPosition(worldPos)
        posMap.set(i, worldPos)
      } else if (bodyNode) {
        posMap.set(i, new Vector3(bodyNode.position.x, bodyNode.position.y, bodyNode.position.z))
      } else {
        posMap.set(i, new Vector3())
      }
    }
    return posMap
  }, [nodes, lampIndices])

  return (
    <>
      {lampIndices.map((i) => {
        const bodyNode = nodes[`recessedLampBody${i}`]
        if (!bodyNode) return null

        const bulbPos = bulbPositions.get(i) ?? new Vector3()

        return (
          <group key={`recessedLamp-${i}`}>
            {/* Primitive preserves: body (with position) → bulb (with local offset) */}
            <primitive object={bodyNode} />

            {/* Spotlight pointing downward */}
            {!disableSpotlights && (
              <RecessedSpotlight
                position={bulbPos}
                color={lampColor}
                intensity={lampIntensity * 2}
              />
            )}
          </group>
        )
      })}
    </>
  )
}

export default RecessedLamp
