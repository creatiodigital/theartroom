import { useMemo, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, DoubleSide, Vector3, SpotLight, MeshStandardMaterial } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'
import { getNodeIndices } from '@/components/scene/spaces/objects/nodeIndices'
import { useActiveRoom } from '@/components/scene/spaces/objects/useActiveRoom'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface RecessedLampProps {
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  count?: number
  indices?: number[]
  disableSpotlights?: boolean
}

const DEFAULT_LAMP_COLOR = '#ffffff'
const DEFAULT_LAMP_INTENSITY = 4.0

/**
 * Recessed lamp using <primitive> to preserve Blender hierarchy (body → bulb).
 * Body position is the Blender origin. Bulb has a small local Y offset.
 * Materials are applied imperatively.
 *
 * Supports non-sequential indices via the `indices` prop.
 */
const RecessedLamp: React.FC<RecessedLampProps> = ({
  nodes,
  count,
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
  // 3, not 2: it must sit clear of BLOOM_THRESHOLD (2.0 in Effects.tsx) or these bulbs stop
  // glowing when the threshold is raised to keep lit walls from blooming.
  const bulbEmissiveIntensity = disableSpotlights ? lampIntensity : 3
  const lampAngle = useSelector((state: RootState) => state.exhibition.recessedLampAngle ?? 0.45)
  const lampDistance = useSelector(
    (state: RootState) => state.exhibition.recessedLampDistance ?? 15,
  )

  // Resolve which indices to render — explicit list or sequential fallback
  const lampIndices = useMemo(
    () =>
      indices ??
      (count !== undefined
        ? Array.from({ length: count }, (_, i) => i)
        : getNodeIndices(nodes, 'recessedLampBody')),
    [indices, count, nodes],
  )

  // Lights in the room the visitor is not in are switched off — three never
  // culls lights itself, so an unseen lamp costs a full frame's shading.
  const isRoomActive = useActiveRoom(nodes, 'recessedLampBody')

  // Shared materials — all recessed lamps use the same body and bulb instance
  const bodyMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: tintedPlastic,
        roughness: 0.4,
        metalness: 0.0,
      }),
    [tintedPlastic],
  )
  useDisposable(bodyMaterial)

  const bulbMaterial = useMemo(
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
  useDisposable(bulbMaterial)

  // The bulb as it looks in a room whose lights are OFF.
  //
  // `useActiveRoom` unmounts the far room's spotlights, but the lamp meshes keep rendering,
  // so without this the unlit room sits dark with its bulbs still emitting — and since bloom
  // came on, glowing hard. It is visible at the hysteresis boundary in the corridor, which is
  // the one place Vienna's two rooms are briefly co-visible.
  //
  // Emissive 0.3 is well under BLOOM_THRESHOLD (1.0 in Effects.tsx), so an off bulb reads as
  // a pale glass face rather than a light. Matches TrackLamp's existing on/off pattern.
  const bulbOffMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#000000',
        emissive: '#cccccc',
        emissiveIntensity: 0.3,
      }),
    [],
  )
  useDisposable(bulbOffMaterial)

  // Apply shared materials imperatively (required when using <primitive>)
  useEffect(() => {
    for (const i of lampIndices) {
      const bodyNode = nodes[`recessedLampBody${i}`]
      const bulbNode = nodes[`recessedLampBulb${i}`]
      if (bodyNode) bodyNode.material = bodyMaterial
      // Per lamp, not per component: a lamp in the room the visitor is not in gets the
      // unlit bulb, so the fixture matches the spotlight that `useActiveRoom` removed.
      if (bulbNode) bulbNode.material = isRoomActive(i) ? bulbMaterial : bulbOffMaterial
    }
  }, [nodes, lampIndices, bodyMaterial, bulbMaterial, bulbOffMaterial, isRoomActive])

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

  // When spotlights are disabled, compute a small number of averaged
  // positions for lightweight fill lights (4 spotlights vs 11 individual ones)
  const fillLightPositions = useMemo(() => {
    if (!disableSpotlights) return []
    const allPositions = Array.from(bulbPositions.values()).filter(
      (p) => p.x !== 0 || p.y !== 0 || p.z !== 0,
    )
    if (allPositions.length === 0) return []

    // Split into 4 groups and average each for even distribution
    const groupCount = 4
    const groupSize = Math.ceil(allPositions.length / groupCount)
    const groups: Vector3[][] = []
    for (let i = 0; i < allPositions.length; i += groupSize) {
      groups.push(allPositions.slice(i, i + groupSize))
    }

    return groups.map((group) => {
      const avg = new Vector3()
      group.forEach((p) => avg.add(p))
      avg.divideScalar(group.length)
      return avg
    })
  }, [disableSpotlights, bulbPositions])

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

            {/* Spotlight pointing downward — inline to avoid component overhead */}
            {!disableSpotlights && isRoomActive(i) && (
              <>
                <object3D
                  position={[bulbPos.x, bulbPos.y - 5, bulbPos.z]}
                  ref={(obj) => {
                    if (obj) {
                      const light = obj.parent?.children.find((c) => c.type === 'SpotLight') as
                        | SpotLight
                        | undefined
                      if (light) light.target = obj
                    }
                  }}
                />
                <spotLight
                  position={[bulbPos.x, bulbPos.y, bulbPos.z]}
                  color={lampColor}
                  intensity={lampIntensity * 2}
                  angle={lampAngle}
                  penumbra={0.8}
                  distance={lampDistance}
                  decay={2}
                  castShadow={false}
                />
              </>
            )}
          </group>
        )
      })}

      {/* Lightweight downward-only fill lights when individual spotlights are disabled */}
      {disableSpotlights &&
        fillLightPositions.map((pos, i) => (
          <group key={`plafond-fill-${i}`}>
            <object3D
              position={[pos.x, pos.y - 10, pos.z]}
              ref={(obj) => {
                if (obj) {
                  const light = obj.parent?.children.find((c) => c.type === 'SpotLight') as
                    | SpotLight
                    | undefined
                  if (light) light.target = obj
                }
              }}
            />
            <spotLight
              position={[pos.x, pos.y, pos.z]}
              color={lampColor}
              intensity={lampIntensity * 3}
              angle={lampAngle}
              penumbra={1}
              distance={lampDistance}
              decay={2}
              castShadow={false}
            />
          </group>
        ))}
    </>
  )
}

export default RecessedLamp
