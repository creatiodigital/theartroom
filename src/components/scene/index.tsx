'use client'

import { Canvas } from '@react-three/fiber'
import { useRef, Suspense } from 'react'
import { NoToneMapping, Mesh } from 'three'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'
import HumanReference from './objects/HumanReference/HumanReference'
import styles from './Scene.module.scss'
import { Space } from './Space'

export const Scene = () => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])

  const handlePlaceholderClick = (_wallId: string) => {
    // Placeholder click handler - used by Space component
  }

  const artworks: TArtwork[] = []

  return (
    <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
      <div className={styles.scene} onContextMenu={(e) => e.preventDefault()}>
        <Canvas
          shadows={false}
          gl={{
            antialias: false,
            toneMapping: NoToneMapping,
          }}
        >
          <Suspense fallback={<Loader />}>
            <group>
              <Controls />
              <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
              <HumanReference />
            </group>
          </Suspense>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}
