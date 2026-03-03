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

interface RoundLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

/**
 * Individual spotlight component for a round lamp.
 * Uses an Object3D target positioned below the bulb.
 */
const RoundSpotlight: React.FC<{
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
  const bulbEmissiveIntensity = 2

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

            {/* Spotlight pointing downward (every other lamp for performance) */}
            {i % 2 === 0 && (
              <RoundSpotlight position={bulbPos} color={lampColor} intensity={lampIntensity * 2} />
            )}
          </group>
        )
      })}
    </>
  )
}

export default RoundLamp
