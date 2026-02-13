'use client'

import { useGLTF } from '@react-three/drei'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

const BENCH_MODEL_PATH = '/assets/furniture/small-bench.glb'

const FurnitureReference = () => {
  const isBenchVisible = useSelector((state: RootState) => state.exhibition.benchVisible ?? false)
  const benchPositionX = useSelector((state: RootState) => state.exhibition.benchPositionX ?? 0)
  const benchPositionZ = useSelector((state: RootState) => state.exhibition.benchPositionZ ?? 0)
  const benchRotationY = useSelector((state: RootState) => state.exhibition.benchRotationY ?? 0)
  const { scene } = useGLTF(BENCH_MODEL_PATH)

  if (!isBenchVisible) return null

  return (
    <primitive
      object={scene.clone()}
      position={[benchPositionX, 0, benchPositionZ]}
      rotation={[0, (benchRotationY * Math.PI) / 180, 0]}
      scale={1}
    />
  )
}

// Preload the model
useGLTF.preload(BENCH_MODEL_PATH)

export default FurnitureReference
