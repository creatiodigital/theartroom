'use client'

import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { useRef, Suspense } from 'react'
import { NoToneMapping, Mesh } from 'three'
import { useSelector } from 'react-redux'

import { Icon } from '@/components/ui/Icon'
import { Loader } from '@/components/ui/Loader'
import { SceneAudioProvider, useSceneAudio } from '@/contexts/SceneAudioContext'
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

const FloatingStopButton = () => {
  const { playingId, stop } = useSceneAudio()

  if (!playingId) return null

  return (
    <button className={styles.stopButton} onClick={stop} title="Stop sound">
      <Icon name="square" size={14} color="#000000" />
    </button>
  )
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
    <SceneAudioProvider>
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
              <Stats />
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
          <FloatingStopButton />
        </div>
      </SceneContext.Provider>
    </SceneAudioProvider>
  )
}
