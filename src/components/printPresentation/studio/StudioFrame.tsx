'use client'

import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  DataTexture,
  ExtrudeGeometry,
  LinearFilter,
  MeshStandardMaterial,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three'

import { assetUrl } from '@/lib/assetUrl'
import {
  EASE_M,
  FRAME_DEPTH_M,
  FRAME_FACE_M,
  FRAMED_BORDER_M,
  FRAMED_BOTTOM_M,
  FRAMED_IMAGE_LONG_M,
  LIP_OVERLAP_M,
  PAPER_THICKNESS_M,
  frameOcclusion,
  imageSize,
} from '@/lib/printPresentation/geometry'
import type { Look, PresentationFrame } from '@/lib/printPresentation/look'

import { ArtworkWindow, type WindowRectPx } from './ArtworkWindow'
import { PencilNumber } from './PaperSheet'

/**
 * Each frame's finish. Woods are the gallery's own textures (its "Dark Wood" is
 * `wooden-frame-dark`); `aspect` is the texture's width over its height. Painted frames are a
 * satin paint over wood: their own color, with the dark wood's grain showing faintly through.
 */
type Finish = { wood: string; aspect: number } | { paint: string }
const FINISH: Record<PresentationFrame, Finish> = {
  'wood-dark': { wood: 'wooden-frame-dark', aspect: 1 },
  'wood-medium': { wood: 'wooden-frame-medium', aspect: 1 },
  'wood-light': { wood: 'wooden-frame-light', aspect: 2 },
  'painted-off-white': { paint: '#ece6da' },
  'painted-black': { paint: '#1d1c1b' },
}

/**
 * The frame's material, as picked for the work: a satin finish, so the grain's relief catches the
 * light. Texture scale is set by the geometry's UVs (in metres of board), not here; `aspect` keeps
 * a non-square texture's grain at its true proportions.
 */
const useFrameMaterial = (frame: PresentationFrame) => {
  const finish = FINISH[frame]
  const base = assetUrl(`/assets/materials/${'wood' in finish ? finish.wood : 'wooden-frame-dark'}`)
  const [diffuse, normal, roughness] = useLoader(TextureLoader, [
    `${base}/diffuse.jpg?v=3`,
    `${base}/normal.jpg?v=3`,
    `${base}/roughness.jpg?v=3`,
  ])
  return useMemo(() => {
    diffuse.colorSpace = SRGBColorSpace
    for (const t of [diffuse, normal, roughness]) {
      t.wrapS = t.wrapT = RepeatWrapping
      t.anisotropy = 16
    }
    if ('paint' in finish) {
      return {
        aspect: 1,
        material: new MeshStandardMaterial({
          color: finish.paint,
          normalMap: normal,
          normalScale: new Vector2(0.2, 0.2),
          roughness: 0.45,
        }),
      }
    }
    return {
      aspect: finish.aspect,
      material: new MeshStandardMaterial({
        map: diffuse,
        normalMap: normal,
        normalScale: new Vector2(0.8, 0.8),
        roughnessMap: roughness,
        roughness: 0.55,
      }),
    }
  }, [finish, diffuse, normal, roughness])
}

/**
 * One bar of the frame, mitered at both ends: `length` along x (its outer edge on y = 0, its inner
 * edge on y = face), `depth` along z from 0. Its UVs are in metres of board, the grain running
 * along the bar, starting at `offset` — so each bar shows its own stretch of wood, at true scale.
 * (The gallery's own `Frame` normalizes UVs per bar, which crams the grain into speckle up close.)
 */
const barGeometry = (
  length: number,
  face: number,
  depth: number,
  tileM: number,
  offset: [number, number],
  aspect: number,
) => {
  const half = length / 2
  const shape = new Shape()
  shape.moveTo(-half, 0)
  shape.lineTo(half, 0)
  shape.lineTo(half - face, face)
  shape.lineTo(-half + face, face)
  shape.closePath()
  const g = new ExtrudeGeometry(shape, {
    depth: depth - 2 * EASE_M,
    bevelEnabled: true,
    bevelThickness: EASE_M,
    bevelSize: EASE_M,
    bevelOffset: -EASE_M,
    bevelSegments: 3,
    curveSegments: 1,
  })
  g.translate(0, 0, EASE_M)
  // Planar UVs per triangle, by which way it faces: the front and back take (x, y), the long sides
  // (x, z), the ends (y, z). x is always the grain direction.
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const n = b.clone().sub(a).cross(c.clone().sub(a))
    const [nx, ny, nz] = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]
      const [u, v] = nz >= nx && nz >= ny ? [p.x, p.y] : ny >= nx ? [p.x, p.z] : [p.y, p.z]
      uv.setXY(i + k, u / tileM + offset[0], (v * aspect) / tileM + offset[1])
    }
  }
  uv.needsUpdate = true
  return g
}

/** A mitered frame around a `width` × `height` outline, its back on z = 0. */
const StudioFrame = ({
  width,
  height,
  face,
  depth,
  frame,
  look,
}: {
  width: number
  height: number
  face: number
  depth: number
  frame: PresentationFrame
  look: Look
}) => {
  const { material, aspect } = useFrameMaterial(frame)
  const bars = useMemo(() => {
    const o = (i: number): [number, number] => [
      look.woodOffset[0] + look.barOffsets[i][0] * 4,
      look.woodOffset[1] + look.barOffsets[i][1] * 4,
    ]
    const h = (i: number) => barGeometry(width, face, depth, look.woodTileM, o(i), aspect)
    const v = (i: number) => barGeometry(height, face, depth, look.woodTileM, o(i), aspect)
    return [
      { geometry: h(0), position: [0, height / 2, 0], rotation: Math.PI },
      { geometry: h(1), position: [0, -height / 2, 0], rotation: 0 },
      { geometry: v(2), position: [-width / 2, 0, 0], rotation: -Math.PI / 2 },
      { geometry: v(3), position: [width / 2, 0, 0], rotation: Math.PI / 2 },
    ] as const
  }, [width, height, face, depth, look, aspect])
  return (
    <group>
      {bars.map((bar, i) => (
        <mesh
          key={i}
          geometry={bar.geometry}
          position={bar.position as unknown as [number, number, number]}
          rotation={[0, 0, bar.rotation]}
          material={material}
        />
      ))}
    </group>
  )
}

const AO_TEXELS = 1024

/** The frame's shade on the sheet (see `frameOcclusion`), as a texture for its aoMap. */
const useFrameOcclusion = (
  sheetW: number,
  sheetH: number,
  openW: number,
  openH: number,
  wallH: number,
) =>
  useMemo(() => {
    const data = frameOcclusion({ sheetW, sheetH, openW, openH, wallH, texels: AO_TEXELS })
    const t = new DataTexture(data, AO_TEXELS, AO_TEXELS)
    t.magFilter = t.minFilter = LinearFilter
    t.needsUpdate = true
    return t
  }, [sheetW, sheetH, openW, openH, wallH])

/**
 * A framed work: the sheet — image plus paper margin, no mat — straight behind the frame, deep
 * enough for the frame to shade it. A limited edition's sheet carries its pencilled number.
 */
export const Framed = ({
  ratio,
  frame,
  edition,
  look,
  onWindow,
  onNumberDrawn,
}: {
  ratio: number
  frame: PresentationFrame
  /** A limited edition's N, pencilled "copy/N" in the margin; null for no number. */
  edition: number | null
  look: Look
  onWindow: (rect: WindowRectPx) => void
  onNumberDrawn: () => void
}) => {
  const [iw, ih] = imageSize(ratio, FRAMED_IMAGE_LONG_M)
  // The sheet: the image plus its paper margin (a little more at the bottom, as printed).
  const sw = iw + 2 * FRAMED_BORDER_M
  const sh = ih + FRAMED_BORDER_M + FRAMED_BOTTOM_M
  const sheetY = (FRAMED_BORDER_M - FRAMED_BOTTOM_M) / 2
  // The frame's opening shows the whole margin; its lip just covers the sheet's cut edge.
  const openW = sw - 2 * LIP_OVERLAP_M
  const openH = sh - 2 * LIP_OVERLAP_M
  const sheetFront = FRAME_DEPTH_M - look.setBack
  const occlusion = useFrameOcclusion(sw, sh, openW, openH, look.setBack)
  // Centred on the frame; the image sits a little above its middle (the deeper bottom margin).
  return (
    <group>
      {/* The frame stands off the wall on its bumpers. */}
      <group position={[0, 0, look.standoff]}>
        <StudioFrame
          width={openW + 2 * FRAME_FACE_M}
          height={openH + 2 * FRAME_FACE_M}
          face={FRAME_FACE_M}
          depth={FRAME_DEPTH_M}
          frame={frame}
          look={look}
        />
        {/* The sheet, behind the glass. */}
        <mesh position={[0, 0, sheetFront - PAPER_THICKNESS_M / 2]}>
          <boxGeometry args={[sw, sh, PAPER_THICKNESS_M]} />
          <meshStandardMaterial color="#fcfbf8" roughness={0.95} aoMap={occlusion} />
        </mesh>
      </group>
      <ArtworkWindow
        width={iw}
        height={ih}
        y={-sheetY}
        z={look.standoff + sheetFront + 0.0002}
        onRect={onWindow}
      />
      {edition !== null && (
        <PencilNumber
          label={`${look.copy}/${edition}`}
          iw={iw}
          ih={ih}
          imageY={-sheetY}
          paperZ={() => look.standoff + sheetFront}
          onDrawn={onNumberDrawn}
        />
      )}
    </group>
  )
}
