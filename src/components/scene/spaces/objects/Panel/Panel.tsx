'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { Color, MeshStandardMaterial } from 'three'
import type { BufferGeometry, Group, Mesh } from 'three'

import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'
import { useAmbientLight } from '@/hooks/useAmbientLight'
import type { RootState } from '@/redux/store'

import { applyPanelSurface } from './panelSurface'
import {
  isPanelEnabled,
  panelColorOf,
  panelFootprint,
  panelMatrix,
  panelPivot,
} from './panelSettings'

/** How far the dashed outline stands off its face, in metres. Untuned. */
const OUTLINE_LIFT = 0.004

/** A face's own normal, scaled to lift its outline clear of the panel. */
const outwardOffset = (face?: Mesh): [number, number, number] => {
  const normals = face?.geometry?.attributes?.normal
  if (!normals || normals.count === 0) return [0, 0, 0]
  return [
    normals.getX(0) * OUTLINE_LIFT,
    normals.getY(0) * OUTLINE_LIFT,
    normals.getZ(0) * OUTLINE_LIFT,
  ]
}

const PANEL_ROUGHNESS = 0.95
const PANEL_AMBIENT_GAIN = 1.0

/**
 * ❌ NO CONTACT SHADOW UNDER A PANEL — removed 2026-09-20, owner's call.
 *
 * There was a `ShadowDecal` gradient quad laid flat on the floor here. It was
 * tuned twice (0.3/0.3 → 0.09/0.45) and still read as a gap rather than as
 * contact: a bright surface sitting above a dark line looks like it is hovering
 * over its own shadow, however tight that line is drawn.
 *
 * A gallery panel under even, diffuse gallery lighting genuinely casts almost
 * nothing on a pale floor, so nothing is being faked away. What grounds the
 * panel now is the floor darkening in `panelSurface.ts` — shading ON the panel
 * as it approaches its base, which is what ambient occlusion would do — plus
 * `PANEL_FLOOR_SINK` below, so the seam itself is clean.
 *
 * Don't re-add a floor decal without a real view proving it helps.
 */

/**
 * How far the panel's box sinks into the floor, in metres.
 *
 * 🔒 Being exactly flush is the BUG, not the goal. Blender authors the panel
 * base at y=0 and the floor surface is also y=0, so the box's bottom face and
 * the floor are two opaque COPLANAR surfaces. They z-fight, and because that
 * face is nearly edge-on from standing height it rasterises to precisely the
 * thin band of pixels at the seam — the renderer flickers between wood and
 * panel along the contact line, and a broken line there reads as a gap under a
 * hovering object. Which is exactly what it was mistaken for on 2026-09-20.
 *
 * Sinking the box a few millimetres puts its bottom face strictly below the
 * floor, where nothing competes for those pixels. The panel cannot then float
 * — you cannot see a gap under something embedded in the ground — and 3mm is
 * far below the ~1cm a visitor could notice at eye height.
 *
 * ⚠️ The BOX only. The contact shadow stays at the floor, and the hangable
 * faces stay where Blender put them so no artwork moves.
 */
const PANEL_FLOOR_SINK = 0.003

interface PanelProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  /** Collision ref, so the visitor can't walk through the panel. */
  panelRef?: React.RefObject<Mesh | null>
}

/**
 * A display panel: a thin freestanding wall with a hangable face on each side.
 *
 * The box and both faces come from the GLB, but the panel's position and
 * rotation are the artist's, stored per exhibition. That transform is applied
 * ONCE here, to a group wrapping all three nodes — and the identical matrix is
 * used by `useBoundingData` for the 2D canvas and by `ArtObjects` for the
 * artworks hanging on it. One source, three readers, so they cannot drift.
 *
 * Nothing renders until the panel is switched on: `isPanelEnabled` defaults to
 * false so an exhibition that predates panels is untouched.
 */
const Panel: React.FC<PanelProps> = ({ i, nodes, panelRef }) => {
  const groupRef = useRef<Group>(null)
  const invalidate = useThree((s) => s.invalidate)

  const settings = useSelector((state: RootState) => state.exhibition.panelSettings?.[String(i)])
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)
  const { ambientColor, scale } = useAmbientLight()

  const node = nodes[`panel${i}`]

  // Standard rather than the room's Lambert, deliberately.
  //
  // Lambert lights PER VERTEX. A panel is a box — eight vertices — so a 6.6 x
  // 2.6 m face has its lighting interpolated from four corner values: no
  // falloff across the surface, no shape to the light, just a flat wash. That
  // is what reads as fake. The room's walls get away with it only because
  // their lighting is baked into their texture map, and a panel has no such map.
  //
  // Standard lights per fragment, so a lamp actually falls across the face.
  // High roughness and no metalness is matte paint: diffuse, no sheen.
  const material = useMemo(() => {
    const next = new MeshStandardMaterial({ roughness: PANEL_ROUGHNESS, metalness: 0 })
    // Its own base, not y=0, so the ground shading lands correctly in any space.
    applyPanelSurface(next, node ? panelFootprint(node).baseY : 0)
    return next
  }, [node])

  useDisposable(material)

  const color = panelColorOf(settings)
  useEffect(() => {
    // `wallBrightness` (1.8 by default) exists to compensate Lambert's missing
    // specular on the room's walls. Applying it to a Standard material would
    // push the color past 1.0 and clip it to a flat wash — the very thing we
    // just moved away from — so the panel takes the ambient tint at its own
    // gain instead.
    const ambientTint = new Color(ambientColor).multiplyScalar(scale * PANEL_AMBIENT_GAIN)
    material.color = ambientTint.clone().multiply(new Color(color))
    invalidate()
  }, [material, ambientColor, scale, color, invalidate])

  const pivot = useMemo(() => (node ? panelPivot(node) : ([0, 0, 0] as const)), [node])

  const faceOffsets = useMemo(
    () => ({
      front: outwardOffset(nodes[`panelFront${i}`]),
      back: outwardOffset(nodes[`panelBack${i}`]),
    }),
    [nodes, i],
  )
  const matrix = useMemo(() => panelMatrix(settings, pivot), [settings, pivot])

  // Driven by hand rather than by position/rotation props: the matrix is the
  // shared artefact, and decomposing it here would be a second implementation
  // of the same transform, free to drift from the one the 2D editor uses.
  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.matrixAutoUpdate = false
    group.matrix.copy(matrix)
    group.matrixWorldNeedsUpdate = true
    invalidate()
  }, [matrix, invalidate])

  if (!node || !isPanelEnabled(settings)) return null

  return (
    <group ref={groupRef}>
      <mesh
        ref={panelRef}
        name={`panel${i}`}
        geometry={node.geometry}
        material={material}
        position={[node.position.x, node.position.y - PANEL_FLOOR_SINK, node.position.z]}
        rotation={node.rotation}
        scale={node.scale}
      />
      {/* The placeholders are exactly coplanar with the box faces, so their
          dashed outline z-fights with the panel and loses — the edges simply
          never appear. Nudged a few millimetres along each face's own normal.
          Only the drawing moves: `useBoundingData` reads the node, not this. */}
      {isPlaceholdersShown && (
        <>
          <group position={faceOffsets.front}>
            <Placeholder name={`panelFront${i}`} nodes={nodes} />
          </group>
          <group position={faceOffsets.back}>
            <Placeholder name={`panelBack${i}`} nodes={nodes} />
          </group>
        </>
      )}
    </group>
  )
}

export default Panel
