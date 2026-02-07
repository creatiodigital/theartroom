import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, DoubleSide } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'

interface RecessedLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

/**
 * Recessed lamp with body and emissive bulb.
 * In the GLB, bulbs are nested inside body nodes (recessedLampBulb0 is child of recessedLampBody0).
 * Both body and bulb geometries are rendered flat using their baked geometry positions.
 * Bulb color/intensity controlled by recessedLampColor/recessedLampIntensity.
 */
const RecessedLamp: React.FC<RecessedLampProps> = ({ nodes, count = 6 }) => {
  const tintedPlastic = useAmbientLightColor('#ffffff')

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const emissiveIntensity = lampIntensity * 50

  const lampsArray = useMemo(() => Array.from({ length: count }), [count])

  return (
    <>
      {lampsArray.map((_, i) => {
        const bodyNode = nodes[`recessedLampBody${i}`]
        const bulbNode = nodes[`recessedLampBulb${i}`]

        return (
          <group key={`recessedLamp-${i}`}>
            {/* Body */}
            {bodyNode && (
              <mesh key={`recessedLampBody-${i}`} name={`recessedLampBody${i}`} geometry={bodyNode.geometry}>
                <meshStandardMaterial color={tintedPlastic} roughness={0.4} metalness={0.0} />
              </mesh>
            )}

            {/* Bulb (emissive) - rendered separately from parent hierarchy */}
            {bulbNode && (
              <mesh
                key={`recessedLampBulb-${i}-${lampColor}-${lampIntensity}`}
                name={`recessedLampBulb${i}`}
                geometry={bulbNode.geometry}
              >
                <meshStandardMaterial
                  color={lampColor}
                  emissive={lampColor}
                  emissiveIntensity={emissiveIntensity}
                  side={DoubleSide}
                />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
}

export default RecessedLamp
