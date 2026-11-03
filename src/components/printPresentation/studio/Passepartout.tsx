'use client'

import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, type Texture } from 'three'

import {
  FRAMED_PAPER_COLOR,
  PASSEPARTOUT_THICKNESS_M,
  type Rect,
} from '@/lib/printPresentation/geometry'

type Corner = [number, number, number]

/** Two triangles, counter-clockwise as seen from the side the quad faces. */
const quad = (a: Corner, b: Corner, c: Corner, d: Corner): Corner[] => [a, b, c, a, c, d]

/** The band between `outer` and `hole` at depth `z`, facing +z (`facing` 1) or −z (−1). */
const ring = (outer: Rect, hole: Rect, z: number, facing: 1 | -1): Corner[] => {
  const bands: Corner[][] = [
    [
      [outer.x0, hole.y1, z],
      [outer.x1, hole.y1, z],
      [outer.x1, outer.y1, z],
      [outer.x0, outer.y1, z],
    ],
    [
      [outer.x0, outer.y0, z],
      [outer.x1, outer.y0, z],
      [outer.x1, hole.y0, z],
      [outer.x0, hole.y0, z],
    ],
    [
      [outer.x0, hole.y0, z],
      [hole.x0, hole.y0, z],
      [hole.x0, hole.y1, z],
      [outer.x0, hole.y1, z],
    ],
    [
      [hole.x1, hole.y0, z],
      [outer.x1, hole.y0, z],
      [outer.x1, hole.y1, z],
      [hole.x1, hole.y1, z],
    ],
  ]
  return bands.flatMap(([a, b, c, d]) => (facing === 1 ? quad(a, b, c, d) : quad(a, d, c, b)))
}

/** Flat-shaded triangles, their UVs spanning `outer` (where the frame's shade map lies). */
const geometryOf = (corners: Corner[], outer: Rect) => {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(corners.flat(), 3))
  g.setAttribute(
    'uv',
    new Float32BufferAttribute(
      corners.flatMap(([x, y]) => [
        (x - outer.x0) / (outer.x1 - outer.x0),
        (y - outer.y0) / (outer.y1 - outer.y0),
      ]),
      2,
    ),
  )
  g.computeVertexNormals()
  return g
}

/**
 * The passepartout: a board the size of the sheet, lying on it from z = 0 to its thickness, with
 * a window cut at 45° — `cut` where it meets the paper, one thickness wider on every side at its
 * face. The board is the paper's own white, through and through (owner, 2026-11-03: an off-white
 * board "is not good", a whiter one than the paper neither — "they cannot be different"), so only
 * its 45° cut, catching the light at its own angle, draws the line round the window. It takes the
 * frame's shade (`occlusion`, laid over `outer` like the sheet's).
 */
export const Passepartout = ({
  outer,
  cut,
  occlusion,
}: {
  outer: Rect
  cut: Rect
  occlusion: Texture
}) => {
  const { board, bevel } = useMemo(() => {
    const t = PASSEPARTOUT_THICKNESS_M
    const face: Rect = { x0: cut.x0 - t, y0: cut.y0 - t, x1: cut.x1 + t, y1: cut.y1 + t }
    const edges: Corner[] = [
      // Outer edges (under the frame's lip), facing out.
      ...quad(
        [outer.x1, outer.y1, 0],
        [outer.x0, outer.y1, 0],
        [outer.x0, outer.y1, t],
        [outer.x1, outer.y1, t],
      ),
      ...quad(
        [outer.x0, outer.y0, 0],
        [outer.x1, outer.y0, 0],
        [outer.x1, outer.y0, t],
        [outer.x0, outer.y0, t],
      ),
      ...quad(
        [outer.x0, outer.y1, 0],
        [outer.x0, outer.y0, 0],
        [outer.x0, outer.y0, t],
        [outer.x0, outer.y1, t],
      ),
      ...quad(
        [outer.x1, outer.y0, 0],
        [outer.x1, outer.y1, 0],
        [outer.x1, outer.y1, t],
        [outer.x1, outer.y0, t],
      ),
    ]
    const board = geometryOf(
      [...ring(outer, face, t, 1), ...ring(outer, cut, 0, -1), ...edges],
      outer,
    )
    const bevel = geometryOf(
      [
        // Top, bottom, left and right of the window, each sloping from the paper up to the face.
        ...quad(
          [cut.x0, cut.y1, 0],
          [cut.x1, cut.y1, 0],
          [face.x1, face.y1, t],
          [face.x0, face.y1, t],
        ),
        ...quad(
          [face.x0, face.y0, t],
          [face.x1, face.y0, t],
          [cut.x1, cut.y0, 0],
          [cut.x0, cut.y0, 0],
        ),
        ...quad(
          [face.x0, face.y0, t],
          [cut.x0, cut.y0, 0],
          [cut.x0, cut.y1, 0],
          [face.x0, face.y1, t],
        ),
        ...quad(
          [cut.x1, cut.y0, 0],
          [face.x1, face.y0, t],
          [face.x1, face.y1, t],
          [cut.x1, cut.y1, 0],
        ),
      ],
      outer,
    )
    return { board, bevel }
  }, [outer, cut])

  return (
    <group>
      <mesh geometry={board}>
        <meshStandardMaterial color={FRAMED_PAPER_COLOR} roughness={0.95} aoMap={occlusion} />
      </mesh>
      <mesh geometry={bevel}>
        <meshStandardMaterial color={FRAMED_PAPER_COLOR} roughness={0.95} />
      </mesh>
    </group>
  )
}
