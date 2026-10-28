'use client'

import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { MeshBasicMaterial, NoBlending, Vector3 } from 'three'

/** A pixel rect in the shot. */
export type WindowRectPx = { x: number; y: number; w: number; h: number }

/**
 * Where the artwork goes: a hole. 🔒 The artwork itself is never in the render. This writes
 * (0, 0, 0, 0) straight into the frame buffer, replacing the wall behind it, so the captured image
 * is transparent exactly there and the page lays the original file underneath. It reports its own
 * pixel rect. It neither casts nor takes a shadow (`userData.artworkWindow`).
 */
export const ArtworkWindow = ({
  width,
  height,
  y = 0,
  z,
  onRect,
}: {
  width: number
  height: number
  y?: number
  z: number
  onRect: (rect: WindowRectPx) => void
}) => {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        blending: NoBlending,
        // Nothing sits in front of the image, so the hole always wins — even where the curled paper
        // around it comes a hair closer to the camera.
        depthTest: false,
        toneMapped: false,
      }),
    [],
  )
  const { camera, size } = useThree()
  useEffect(() => {
    camera.updateMatrixWorld()
    const corner = (dx: number, dy: number) => {
      const p = new Vector3(dx, y + dy, z).project(camera)
      return [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height]
    }
    const [x0, y0] = corner(-width / 2, height / 2)
    const [x1, y1] = corner(width / 2, -height / 2)
    onRect({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
  }, [camera, size, width, height, y, z, onRect])
  return (
    <mesh
      position={[0, y, z]}
      material={material}
      renderOrder={10}
      userData={{ artworkWindow: true }}
    >
      <planeGeometry args={[width, height]} />
    </mesh>
  )
}
