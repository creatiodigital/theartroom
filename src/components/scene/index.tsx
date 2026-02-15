'use client'

import { Canvas } from '@react-three/fiber'
import { useRef, Suspense } from 'react'
import { NoToneMapping, Mesh } from 'three'
import { useSelector } from 'react-redux'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'
import FurnitureReference from './objects/FurnitureReference/FurnitureReference'
import HumanReference from './objects/HumanReference/HumanReference'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import styles from './Scene.module.scss'
import { Space } from './Space'
import { WebGLMonitor } from './WebGLMonitor'

interface SceneProps {
  hideLoader?: boolean
}

export const Scene = ({ hideLoader }: SceneProps = {}) => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const exhibitionUrl = useSelector((state: RootState) => state.exhibition.url)

  const handlePlaceholderClick = (_wallId: string) => {
    // Placeholder click handler - used by Space component
  }

  const artworks: TArtwork[] = []

  return (
    <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
      <div className={styles.scene} onContextMenu={(e) => e.preventDefault()}>
        <SceneErrorBoundary exhibitionUrl={exhibitionUrl}>
          <Canvas
            shadows={false}
            gl={{
              antialias: false,
              toneMapping: NoToneMapping,
            }}
          >
            <WebGLMonitor exhibitionUrl={exhibitionUrl} />
            <Suspense fallback={hideLoader ? null : <Loader />}>
              <group>
                <Controls />
                <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
                <HumanReference />
                <FurnitureReference />
              </group>
            </Suspense>
          </Canvas>
        </SceneErrorBoundary>
      </div>
    </SceneContext.Provider>
  )
}
