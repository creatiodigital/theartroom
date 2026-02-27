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

interface TrackLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_MATERIAL_COLOR = '#ffffff'

/**
 * Native Three.js spotlight for a track lamp.
 * Uses body→bulb direction to aim toward the wall.
 */
const TrackSpotlight: React.FC<{
  position: Vector3
  aimDirection: Vector3
  color: string
  intensity: number
  angle: number
  distance: number
}> = ({ position, aimDirection, color, intensity, angle, distance }) => {
  const lightRef = useRef<SpotLight>(null)
  const targetRef = useRef<Object3D>(null)

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current
    }
  }, [])

  // Target placed along the aim direction, lower down (artwork height)
  const targetPos: [number, number, number] = [
    position.x + aimDirection.x * 2,
    position.y - 1.5,
    position.z + aimDirection.z * 2,
  ]

  return (
    <>
      <object3D ref={targetRef} position={targetPos} />
      <spotLight
        ref={lightRef}
        position={[position.x, position.y, position.z]}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={0.8}
        distance={distance}
        decay={2}
        castShadow={false}
      />
    </>
  )
}

/**
 * Track lamp with arm, body, emissive bulb, and native Three.js SpotLight.
 * Iterates over indexed meshes: trackLampArm0, trackLampBody0, trackLampBulb0, etc.
 * SpotLights aim toward the wall using body→bulb geometry direction.
 *
 * Supports per-lamp rotation (Y-axis) and on/off toggle via trackLampSettings.
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
    (state: RootState) => state.exhibition.trackLampIntensity ?? 4.0,
  )
  const lampAngle = useSelector((state: RootState) => state.exhibition.trackLampAngle ?? 0.45)
  const lampDistance = useSelector((state: RootState) => state.exhibition.trackLampDistance ?? 5.0)

  // Per-lamp settings (rotation + on/off)
  const trackLampSettings = useSelector((state: RootState) => state.exhibition.trackLampSettings)

  const bulbEmissiveIntensity = 2

  // Compute arm pivot positions (where arm connects to the rail/ceiling)
  // plus bulb positions and aim directions
  const lampData = useMemo(() => {
    const data: Array<{
      armPivot: [number, number, number]
      bulbPos: Vector3
      aimDir: Vector3
    }> = []

    for (let i = 0; i < count; i++) {
      const armNode = nodes[`trackLampArm${i}`]
      const bulbNode = nodes[`trackLampBulb${i}`]
      const bodyNode = nodes[`trackLampBody${i}`]

      // Arm pivot = arm geometry center (where it connects to ceiling rail)
      let armPivot: [number, number, number] = [0, 0, 0]
      if (armNode) {
        const armBox = new Box3().setFromBufferAttribute(
          armNode.geometry.attributes.position as BufferAttribute,
        )
        const armCenter = new Vector3()
        armBox.getCenter(armCenter)
        // Use the top of the arm bounding box as pivot (ceiling connection)
        armPivot = [armCenter.x, armBox.max.y, armCenter.z]
      }

      let bulbPos = new Vector3()
      let aimDir = new Vector3(0, -1, 0)

      if (bulbNode && bodyNode) {
        const bulbBox = new Box3().setFromBufferAttribute(
          bulbNode.geometry.attributes.position as BufferAttribute,
        )
        const bulbCenter = new Vector3()
        bulbBox.getCenter(bulbCenter)
        bulbPos = bulbCenter

        const bodyBox = new Box3().setFromBufferAttribute(
          bodyNode.geometry.attributes.position as BufferAttribute,
        )
        const bodyCenter = new Vector3()
        bodyBox.getCenter(bodyCenter)
        aimDir = new Vector3().subVectors(bulbCenter, bodyCenter).normalize()
      } else if (bulbNode) {
        const bulbBox = new Box3().setFromBufferAttribute(
          bulbNode.geometry.attributes.position as BufferAttribute,
        )
        const bulbCenter = new Vector3()
        bulbBox.getCenter(bulbCenter)
        bulbPos = bulbCenter
      }

      data.push({ armPivot, bulbPos, aimDir })
    }

    return data
  }, [nodes, count])

  const lampsArray = useMemo(() => Array.from({ length: count }), [count])

  return (
    <>
      {lampsArray.map((_, i) => {
        const armNode = nodes[`trackLampArm${i}`]
        const bodyNode = nodes[`trackLampBody${i}`]
        const bulbNode = nodes[`trackLampBulb${i}`]
        const { armPivot, bulbPos, aimDir } = lampData[i]

        // Per-lamp settings
        const settings = trackLampSettings?.[String(i)]
        const isEnabled = settings?.enabled ?? true
        const rotation = settings?.rotation ?? 0
        const rotationRad = (rotation * Math.PI) / 180

        return (
          <group key={`trackLamp-${i}`} position={armPivot} rotation={[0, rotationRad, 0]}>
            <group position={[-armPivot[0], -armPivot[1], -armPivot[2]]}>
              {/* Arm */}
              {armNode && (
                <mesh
                  key={`trackLampArm-${i}-${materialColor}`}
                  name={`trackLampArm${i}`}
                  geometry={armNode.geometry}
                >
                  <meshStandardMaterial color={tintedMaterial} roughness={0.4} metalness={0.0} />
                </mesh>
              )}

              {/* Body */}
              {bodyNode && (
                <mesh
                  key={`trackLampBody-${i}-${materialColor}`}
                  name={`trackLampBody${i}`}
                  geometry={bodyNode.geometry}
                >
                  <meshStandardMaterial color={tintedMaterial} roughness={0.4} metalness={0.0} />
                </mesh>
              )}

              {/* Bulb (emissive) — dim when disabled */}
              {bulbNode && (
                <mesh
                  key={`trackLampBulb-${i}-${lampColor}-${isEnabled}`}
                  name={`trackLampBulb${i}`}
                  geometry={bulbNode.geometry}
                >
                  <meshStandardMaterial
                    color="#000000"
                    emissive={isEnabled ? lampColor : '#cccccc'}
                    emissiveIntensity={isEnabled ? bulbEmissiveIntensity : 0.3}
                    toneMapped={false}
                    side={DoubleSide}
                  />
                </mesh>
              )}

              {/* Native Three.js spotlight — only when enabled */}
              {isEnabled && bulbNode && aimDir && (
                <TrackSpotlight
                  position={bulbPos}
                  aimDirection={aimDir}
                  color={lampColor}
                  intensity={lampIntensity * 2}
                  angle={lampAngle}
                  distance={lampDistance}
                />
              )}
            </group>
          </group>
        )
      })}
    </>
  )
}

export default TrackLamp
