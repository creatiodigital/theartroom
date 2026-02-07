import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, DoubleSide } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'

interface TrackLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0
const DEFAULT_MATERIAL_COLOR = '#ffffff'

/**
 * Track lamp with arm, body, and emissive bulb.
 * Iterates over indexed meshes: trackLampArm0, trackLampBody0, trackLampBulb0, etc.
 * Bulb color/intensity controlled by trackLampColor/trackLampIntensity.
 * Arm/body color controlled by trackLampMaterialColor.
 */
const TrackLamp: React.FC<TrackLampProps> = ({ nodes, count = 14 }) => {
  const materialColor = useSelector(
    (state: RootState) => state.exhibition.trackLampMaterialColor ?? DEFAULT_MATERIAL_COLOR,
  )
  const tintedMaterial = useAmbientLightColor(materialColor)

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.trackLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.trackLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const emissiveIntensity = lampIntensity * 50

  const lampsArray = useMemo(() => Array.from({ length: count }), [count])

  return (
    <>
      {lampsArray.map((_, i) => {
        const armNode = nodes[`trackLampArm${i}`]
        const bodyNode = nodes[`trackLampBody${i}`]
        const bulbNode = nodes[`trackLampBulb${i}`]

        return (
          <group key={`trackLamp-${i}`}>
            {/* Arm */}
            {armNode && (
              <mesh key={`trackLampArm-${i}-${materialColor}`} name={`trackLampArm${i}`} geometry={armNode.geometry}>
                <meshStandardMaterial color={tintedMaterial} roughness={0.4} metalness={0.0} />
              </mesh>
            )}

            {/* Body */}
            {bodyNode && (
              <mesh key={`trackLampBody-${i}-${materialColor}`} name={`trackLampBody${i}`} geometry={bodyNode.geometry}>
                <meshStandardMaterial color={tintedMaterial} roughness={0.4} metalness={0.0} />
              </mesh>
            )}

            {/* Bulb (emissive) */}
            {bulbNode && (
              <mesh
                key={`trackLampBulb-${i}-${lampColor}-${emissiveIntensity}`}
                name={`trackLampBulb${i}`}
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

export default TrackLamp
