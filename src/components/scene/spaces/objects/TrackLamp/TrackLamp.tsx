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
import { getSpaceFeatures } from '@/config/spaceConfig'
import type { RootState } from '@/redux/store'

interface TrackLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_MATERIAL_COLOR = '#ffffff'

/**
 * Native Three.js spotlight for a track lamp.
 * Position and target are in world space.
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
 * Track lamp component using <primitive> to preserve Blender hierarchy.
 *
 * Scene graph: armNode (Y rotation at top) → bodyNode (tilt) → bulbNode
 * The arm's position IS the Blender origin (pivot for Y-rotation).
 * Materials are applied imperatively since <primitive> reuses original objects.
 *
 * Supports per-lamp Y-rotation, position offset, and on/off toggle.
 */
const TrackLamp: React.FC<TrackLampProps> = ({ nodes, count = 14 }) => {
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'
  const spaceFeatures = getSpaceFeatures(spaceId)

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

  // Per-lamp settings (rotation + on/off + offset)
  const trackLampSettings = useSelector((state: RootState) => state.exhibition.trackLampSettings)

  const bulbEmissiveIntensity = 2

  // Shared materials — all track lamps reuse the same instances
  const armBodyMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: tintedMaterial,
        roughness: 0.4,
        metalness: 0.0,
      }),
    [tintedMaterial],
  )

  const bulbOnMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#000000',
        emissive: lampColor,
        emissiveIntensity: bulbEmissiveIntensity,
        toneMapped: false,
        side: DoubleSide,
      }),
    [lampColor, bulbEmissiveIntensity],
  )

  const bulbOffMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#000000',
        emissive: '#cccccc',
        emissiveIntensity: 0.3,
        toneMapped: false,
        side: DoubleSide,
      }),
    [],
  )

  // Apply shared materials imperatively (required when using <primitive>)
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const armNode = nodes[`trackLampArm${i}`]
      const bodyNode = nodes[`trackLampBody${i}`]
      const bulbNode = nodes[`trackLampBulb${i}`]

      const settings = trackLampSettings?.[String(i)]
      const isEnabled = settings?.enabled ?? true

      if (armNode) armNode.material = armBodyMaterial
      if (bodyNode) bodyNode.material = armBodyMaterial
      if (bulbNode) bulbNode.material = isEnabled ? bulbOnMaterial : bulbOffMaterial
    }
  }, [nodes, count, armBodyMaterial, bulbOnMaterial, bulbOffMaterial, trackLampSettings])

  // Compute world-space bulb positions and aim directions using node transforms directly.
  // We can't use getWorldPosition() because <primitive> re-parents nodes.
  const lampData = useMemo(() => {
    const data: Array<{
      bulbWorldPos: Vector3
      aimDir: Vector3
    }> = []

    for (let i = 0; i < count; i++) {
      const armNode = nodes[`trackLampArm${i}`]
      const bulbNode = nodes[`trackLampBulb${i}`]
      const bodyNode = nodes[`trackLampBody${i}`]

      let bulbWorldPos = new Vector3()
      let aimDir = new Vector3(0, -1, 0)

      if (armNode && bodyNode && bulbNode) {
        // Walk the transform chain manually: arm → body (with rotation) → bulb
        // 1. Bulb position in body-local space, rotated by body quaternion
        const bulbInBody = bulbNode.position.clone().applyQuaternion(bodyNode.quaternion)
        // 2. Body position in arm-local space + rotated bulb offset
        const bulbInArm = bodyNode.position.clone().add(bulbInBody)
        // 3. World position = arm position + arm-local bulb position
        bulbWorldPos = armNode.position.clone().add(bulbInArm)

        // Aim direction: use the bulb's dominant horizontal axis (the wall-facing direction)
        // in body-local space, then rotate by the body quaternion.
        // This ignores the small off-center mounting offset that would skew the aim.
        const bulbLocal = bulbNode.position
        const absX = Math.abs(bulbLocal.x)
        const absZ = Math.abs(bulbLocal.z)
        let aimAxis: Vector3
        if (absX > absZ) {
          aimAxis = new Vector3(Math.sign(bulbLocal.x), 0, 0)
        } else {
          aimAxis = new Vector3(0, 0, Math.sign(bulbLocal.z))
        }
        aimDir = aimAxis.applyQuaternion(bodyNode.quaternion)
      }

      data.push({ bulbWorldPos, aimDir })
    }

    return data
  }, [nodes, count])

  const lampsArray = useMemo(() => Array.from({ length: count }), [count])

  return (
    <>
      {lampsArray.map((_, i) => {
        const armNode = nodes[`trackLampArm${i}`]
        if (!armNode) return null

        const { bulbWorldPos, aimDir } = lampData[i]

        // Per-lamp settings
        const settings = trackLampSettings?.[String(i)]
        const isEnabled = settings?.enabled ?? true
        const rotation = settings?.rotation ?? 0
        const rotationRad = (rotation * Math.PI) / 180
        const offset = settings?.offset ?? 0

        // Arm position = Blender origin (top of arm, ceiling connection)
        const armPos = armNode.position

        // Apply position offset on the axis configured for this lamp
        const axis = spaceFeatures.trackLampOffsetAxes?.[i] ?? 'x'
        const offsetPos: [number, number, number] = [
          armPos.x + (axis === 'x' ? offset : 0),
          armPos.y,
          armPos.z + (axis === 'z' ? offset : 0),
        ]

        return (
          <group key={`trackLamp-${i}`} position={offsetPos} rotation={[0, rotationRad, 0]}>
            <group position={[-armPos.x, -armPos.y, -armPos.z]}>
              {/* Primitive preserves: arm → body (with tilt rotation) → bulb */}
              <primitive object={armNode} />

              {/* Spotlight — inside inner group so -armPos cancels with offsetPos */}
              {isEnabled && (
                <TrackSpotlight
                  position={bulbWorldPos}
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
