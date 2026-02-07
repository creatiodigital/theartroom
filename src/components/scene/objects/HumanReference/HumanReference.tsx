'use client'

import { useGLTF } from '@react-three/drei'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

const HUMAN_MODEL_PATH = '/assets/human.glb'

const HumanReference = () => {
  const isHumanVisible = useSelector((state: RootState) => state.scene.isHumanVisible)
  const { scene } = useGLTF(HUMAN_MODEL_PATH)

  if (!isHumanVisible) return null

  return (
    <primitive
      object={scene.clone()}
      position={[0, 0, 0]}
      scale={1}
    />
  )
}

// Preload the model
useGLTF.preload(HUMAN_MODEL_PATH)

export default HumanReference
