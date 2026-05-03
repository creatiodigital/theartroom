'use client'

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

const SOFA_PATH = '/assets/objects/sofa/sofa.glb'

useGLTF.preload(SOFA_PATH)

interface SofaProps {
  /** World position [x, y, z]. Default sits on the floor (y=-1.5), against the wall. */
  position?: [number, number, number]
  /** Uniform scale applied to the GLB. Adjust if the model loads too big/small. */
  scale?: number
  /** Rotation in radians around Y. Default faces forward (+Z). */
  rotationY?: number
}

/**
 * Sofa that sits under the artwork as a size reference.
 * Model origin/scale are defined by the GLB itself — tweak position/scale
 * props to land it cleanly against the back wall.
 */
export const Sofa = ({
  position = [0, -1.5, 0.45],
  scale = 1,
  rotationY = -Math.PI / 2,
}: SofaProps) => {
  const { scene } = useGLTF(SOFA_PATH)
  const clone = useMemo(() => scene.clone(), [scene])

  // Dev-only sanity check: log the real-world footprint the GLB reports.
  // A typical 3-seat sofa is ~2.1m wide × 0.85m deep × 0.85m tall.
  // If the numbers here are way off, the model was exported in the wrong
  // units and we need to compensate via `scale`.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())

    console.info(
      `[Sofa] native dimensions (m): width=${size.x.toFixed(2)}  depth=${size.z.toFixed(2)}  height=${size.y.toFixed(2)}`,
    )
  }, [clone])

  return <primitive object={clone} position={position} rotation={[0, rotationY, 0]} scale={scale} />
}
