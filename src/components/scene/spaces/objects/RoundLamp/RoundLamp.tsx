import { useMemo, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
  Mesh,
  BufferGeometry,
  DoubleSide,
  Vector3,
  Box3,
  Object3D,
  SpotLight,
  BufferAttribute,
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
 * Round lamp with body and emissive bulb, plus downward spotlight.
 * In the GLB, meshes are named: roundLampBody0, roundLampBulb0, etc.
 * Reuses the recessed lamp color/intensity controls.
 */
const RoundLamp: React.FC<RoundLampProps> = ({ nodes, count = 15 }) => {
  const tintedPlastic = useAmbientLightColor('#ffffff')

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const bulbEmissiveIntensity = 2

  // Compute the center position of each bulb geometry for spotlight placement
  const bulbPositions = useMemo(() => {
    const positions: Vector3[] = []
    for (let i = 0; i < count; i++) {
      const bulbNode = nodes[`roundLampBulb${i}`]
      if (bulbNode) {
        const box = new Box3().setFromBufferAttribute(
          bulbNode.geometry.attributes.position as BufferAttribute,
        )
        const center = new Vector3()
        box.getCenter(center)
        positions.push(center)
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
        const bulbNode = nodes[`roundLampBulb${i}`]
        const bulbPos = bulbPositions[i]

        return (
          <group key={`roundLamp-${i}`}>
            {/* Body */}
            {bodyNode && (
              <mesh
                key={`roundLampBody-${i}`}
                name={`roundLampBody${i}`}
                geometry={bodyNode.geometry}
              >
                <meshStandardMaterial color={tintedPlastic} roughness={0.4} metalness={0.0} />
              </mesh>
            )}

            {/* Bulb (emissive) */}
            {bulbNode && (
              <mesh
                key={`roundLampBulb-${i}-${lampColor}-${lampIntensity}`}
                name={`roundLampBulb${i}`}
                geometry={bulbNode.geometry}
              >
                <meshStandardMaterial
                  color="#000000"
                  emissive={lampColor}
                  emissiveIntensity={bulbEmissiveIntensity}
                  toneMapped={false}
                  side={DoubleSide}
                />
              </mesh>
            )}

            {/* Spotlight pointing downward (every other lamp for performance) */}
            {bulbNode && i % 2 === 0 && (
              <RoundSpotlight position={bulbPos} color={lampColor} intensity={lampIntensity * 2} />
            )}
          </group>
        )
      })}
    </>
  )
}

export default RoundLamp
