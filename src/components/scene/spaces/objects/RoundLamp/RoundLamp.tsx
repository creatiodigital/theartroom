import { useMemo, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Mesh, BufferGeometry, DoubleSide, Vector3, SpotLight, MeshStandardMaterial } from 'three'

import { useAmbientLightColor } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'
import { getNodeIndices } from '@/components/scene/spaces/objects/nodeIndices'
import { useActiveRoom } from '@/components/scene/spaces/objects/useActiveRoom'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

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
const RoundLamp: React.FC<RoundLampProps> = ({ nodes, count }) => {
  // Count comes from the GLB unless a space deliberately overrides it.
  // Which lamps to render, BY NODE INDEX — never `0..count-1`.
  //
  // A GLB's numbering is not guaranteed contiguous: deleting a fixture in Blender
  // leaves a hole, and Madrid's round lamps are 0,2,4,5,7,9,10,12,14,15,16. Counting
  // them gives 11 and looping 0..10 renders only the seven that happen to fall in
  // that range — 12,14,15,16 silently never appear, while the ceiling's baked
  // texture still shows their silhouettes. `isRoomActive` has the same requirement:
  // its predicate is checked against real node indices, so a loop counter would also
  // mis-cull a gapped multi-room space.
  //
  // `getNodeIndices` is gap-tolerant by design and `RecessedLamp` already used it —
  // this brings RoundLamp in line. The `count` prop stays as an explicit override.
  const lampIndices = useMemo(
    () =>
      count !== undefined
        ? Array.from({ length: count }, (_, i) => i)
        : getNodeIndices(nodes, 'roundLampBody'),
    [count, nodes],
  )
  // Lights in the room the visitor is not in are switched off — three never
  // culls lights itself, so an unseen lamp costs a full frame's shading.
  const isRoomActive = useActiveRoom(nodes, 'roundLampBody')
  const tintedPlastic = useAmbientLightColor('#ffffff')

  const lampColor = useSelector(
    (state: RootState) => state.exhibition.recessedLampColor ?? DEFAULT_LAMP_COLOR,
  )
  const lampIntensity = useSelector(
    (state: RootState) => state.exhibition.recessedLampIntensity ?? DEFAULT_LAMP_INTENSITY,
  )
  const bulbEmissiveIntensity = lampIntensity
  const lampAngle = useSelector((state: RootState) => state.exhibition.recessedLampAngle ?? 0.45)
  const lampDistance = useSelector(
    (state: RootState) => state.exhibition.recessedLampDistance ?? 15,
  )

  // Shared materials — all 17 lamps use the same body and bulb material
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
      const bodyNode = nodes[`roundLampBody${i}`]
      const bulbNode = nodes[`roundLampBulb${i}`]
      if (bodyNode) bodyNode.material = bodyMaterial
      // Per lamp, not per component: a lamp in the room the visitor is not in gets the
      // unlit bulb, so the fixture matches the spotlight that `useActiveRoom` removed.
      if (bulbNode) bulbNode.material = isRoomActive(i) ? bulbMaterial : bulbOffMaterial
    }
  }, [nodes, lampIndices, bodyMaterial, bulbMaterial, bulbOffMaterial, isRoomActive])

  // Compute world-space bulb positions for spotlight placement
  const bulbPositions = useMemo(() => {
    const positions = new Map<number, Vector3>()
    for (const i of lampIndices) {
      const bodyNode = nodes[`roundLampBody${i}`]
      const bulbNode = nodes[`roundLampBulb${i}`]

      if (bodyNode && bulbNode) {
        bodyNode.updateWorldMatrix(true, true)
        const worldPos = new Vector3()
        bulbNode.getWorldPosition(worldPos)
        positions.set(i, worldPos)
      } else if (bodyNode) {
        positions.set(i, new Vector3(bodyNode.position.x, bodyNode.position.y, bodyNode.position.z))
      } else {
        positions.set(i, new Vector3())
      }
    }
    return positions
  }, [nodes, lampIndices])

  return (
    <>
      {lampIndices.map((i) => {
        const bodyNode = nodes[`roundLampBody${i}`]
        if (!bodyNode) return null

        const bulbPos = bulbPositions.get(i) ?? new Vector3()

        return (
          <group key={`roundLamp-${i}`}>
            {/* Primitive preserves: body (with position) → bulb (with local offset) */}
            <primitive object={bodyNode} />

            {/* Per-lamp downward spotlight — no track lamps in plafond-only mode.
                Skipped entirely when the visitor is in another room. */}
            {isRoomActive(i) && (
              <>
                <object3D
                  position={[bulbPos.x, bulbPos.y - 10, bulbPos.z]}
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
                  penumbra={1}
                  distance={lampDistance}
                  decay={2}
                  castShadow={false}
                />
              </>
            )}
          </group>
        )
      })}
    </>
  )
}

export default RoundLamp
