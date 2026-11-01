import { useMemo } from 'react'
import { Shape, ExtrudeGeometry, Material, Vector3 } from 'three'
import { RoundedBox } from '@react-three/drei'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface FrameProps {
  width: number
  height: number
  thickness: number // Border width (XY)
  depth?: number // Z-depth (how much it protrudes)
  material: Material
  cornerStyle?: 'mitered' | 'straight' // 'mitered' = 45° angled, 'straight' = butt joint
}

const BEVEL_SEGMENTS = 3
/** A sanded moulding's eased edge (the print studio's `EASE_M`). */
const EDGE_EASE_M = 0.0008
const ROUNDED_BEVEL_RADIUS = 0.002

/**
 * AR-169 (Eduardo 2026-10-29: "a realistic wooden texture size, no matter the thickness or size
 * of the frame"): one tile of the wood maps (diffuse, normal, roughness) covers this much board,
 * in metres — the print studio's frames (`StudioFrame`, 0.26–0.36 m). A frame's UVs are in tiles
 * of real board, so a bigger frame shows more wood, never bigger grain. `Display` scales it by the
 * artist's texture scale (1× at its default) and the texture's own width-to-height ratio.
 */
export const WOOD_TILE_M = 0.31

/** Each bar starts on its own stretch of board (the miter joints read as joints). */
const BAR_OFFSETS: [number, number][] = [
  [0, 0],
  [0.37, 0.61],
  [0.74, 0.23],
  [0.11, 0.86],
]

/**
 * Create a mitered frame piece using Shape + ExtrudeGeometry.
 * The shape is a trapezoid (mitered at 45° on both ends). Its UVs are in tiles of real board
 * (`WOOD_TILE_M`), the grain running along the bar, from `offset`.
 */
function createMiteredPieceGeo(
  length: number,
  thickness: number,
  depth: number,
  offset: [number, number],
): ExtrudeGeometry {
  const halfLen = length / 2
  const t = thickness

  // Eased edges, as on a real sanded moulding (and the print studio's frames, AR-169): the
  // bevel's 0.8 mm catches a line of light along every edge — razor edges read as CG. Inset by
  // the same amount (`bevelOffset`) so the outline stays exactly the frame's size.
  const ease = Math.min(EDGE_EASE_M, thickness * 0.1, depth * 0.2)

  const shape = new Shape()
  shape.moveTo(-halfLen, 0)
  shape.lineTo(halfLen, 0)
  shape.lineTo(halfLen - t, -t)
  shape.lineTo(-halfLen + t, -t)
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, {
    depth: depth - 2 * ease,
    bevelEnabled: true,
    bevelSize: ease,
    bevelThickness: ease,
    bevelOffset: -ease,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: 1,
  })

  geo.translate(0, 0, ease - depth / 2)

  // Planar UVs per triangle, by the way it faces: the front and back take (x, y), the long sides
  // (x, z), the ends (y, z) — x, along the bar, is always the grain. (Normalizing each bar to 0–1,
  // as before, crammed the whole texture across a 1–2 cm bar: streaks, never wood.)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const ab = new Vector3()
  const ac = new Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const n = ab.subVectors(b, a).cross(ac.subVectors(c, a))
    const [nx, ny, nz] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]!
      const [u, v] = nz >= nx && nz >= ny ? [p.x, p.y] : ny >= nx ? [p.x, p.z] : [p.y, p.z]
      uv.setXY(i + k, u / WOOD_TILE_M + offset[0], v / WOOD_TILE_M + offset[1])
    }
  }
  uv.needsUpdate = true

  return geo
}

/** Mitered frame — 45° corner joints */
const MiteredFrame = ({
  width,
  height,
  thickness,
  depth,
  material,
}: Omit<FrameProps, 'cornerStyle'>) => {
  const d = depth!

  const { topGeo, bottomGeo, rightGeo, leftGeo } = useMemo(
    () => ({
      topGeo: createMiteredPieceGeo(width, thickness, d, BAR_OFFSETS[0]!),
      bottomGeo: createMiteredPieceGeo(width, thickness, d, BAR_OFFSETS[1]!),
      rightGeo: createMiteredPieceGeo(height, thickness, d, BAR_OFFSETS[2]!),
      leftGeo: createMiteredPieceGeo(height, thickness, d, BAR_OFFSETS[3]!),
    }),
    [width, height, thickness, d],
  )
  useDisposable(topGeo)
  useDisposable(bottomGeo)
  useDisposable(rightGeo)
  useDisposable(leftGeo)

  return (
    <group position={[0, 0, d / 2]}>
      <mesh
        geometry={topGeo}
        material={material}
        castShadow
        receiveShadow
        position={[0, height / 2, 0]}
      />
      <mesh
        geometry={bottomGeo}
        material={material}
        castShadow
        receiveShadow
        position={[0, -height / 2, 0]}
        rotation={[0, 0, Math.PI]}
      />
      <mesh
        geometry={rightGeo}
        material={material}
        castShadow
        receiveShadow
        position={[width / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      />
      <mesh
        geometry={leftGeo}
        material={material}
        castShadow
        receiveShadow
        position={[-width / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      />
    </group>
  )
}

/** Straight frame — butt joint corners (top/bottom fit between left/right) */
const StraightFrame = ({
  width,
  height,
  thickness,
  depth,
  material,
}: Omit<FrameProps, 'cornerStyle'>) => {
  const d = depth!
  const innerWidth = width - thickness * 2

  return (
    <group position={[0, 0, d / 2]}>
      <RoundedBox
        args={[thickness, height, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[-(width / 2 - thickness / 2), 0, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
      <RoundedBox
        args={[thickness, height, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[width / 2 - thickness / 2, 0, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
      <RoundedBox
        args={[innerWidth, thickness, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[0, height / 2 - thickness / 2, 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
      <RoundedBox
        args={[innerWidth, thickness, d]}
        radius={ROUNDED_BEVEL_RADIUS}
        smoothness={2}
        castShadow
        receiveShadow
        position={[0, -(height / 2 - thickness / 2), 0]}
      >
        <primitive attach="material" object={material} />
      </RoundedBox>
    </group>
  )
}

const Frame: React.FC<FrameProps> = ({
  width,
  height,
  thickness,
  depth = 0.01,
  material,
  cornerStyle = 'mitered',
}) => {
  if (cornerStyle === 'straight') {
    return (
      <StraightFrame
        width={width}
        height={height}
        thickness={thickness}
        depth={depth}
        material={material}
      />
    )
  }
  return (
    <MiteredFrame
      width={width}
      height={height}
      thickness={thickness}
      depth={depth}
      material={material}
    />
  )
}

export default Frame
