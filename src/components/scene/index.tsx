'use client'

import { Canvas } from '@react-three/fiber'
import { Stats } from '@react-three/drei'

import { useRef, Suspense } from 'react'
import { NoToneMapping, Mesh } from 'three'
import { useSelector } from 'react-redux'
import { Volume2, VolumeX } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { Loader } from '@/components/ui/Loader'
import { SceneAudioProvider, useSceneAudioState, useSceneAudioActions } from '@/contexts/SceneAudioContext'
import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'

import HumanReference from './objects/HumanReference/HumanReference'
import { SceneErrorBoundary } from './SceneErrorBoundary'
import styles from './Scene.module.scss'
import { Space } from './Space'
import { WebGLMonitor } from './WebGLMonitor'

interface SceneProps {
  hideLoader?: boolean
}

const FloatingMuteButton = () => {
  const { hasActiveAudio, isMuted } = useSceneAudioState()
  const { toggleMute } = useSceneAudioActions()

  if (!hasActiveAudio) return null

  return (
    <button
      className={styles.stopButton}
      onClick={toggleMute}
      title={isMuted ? 'Unmute sound' : 'Mute sound'}
    >
      {isMuted ? (
        <VolumeX size={20} strokeWidth={ICON_STROKE_WIDTH} />
      ) : (
        <Volume2 size={20} strokeWidth={ICON_STROKE_WIDTH} />
      )}
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
              dpr={[1, 1.5]}
              gl={{
                antialias: false,
                toneMapping: NoToneMapping,
                powerPreference: 'high-performance',
              }}
            >
              <Stats />
              <WebGLMonitor exhibitionUrl={exhibitionUrl} />
              <Suspense fallback={hideLoader ? null : <Loader />}>
                <group>
                  <Controls />
                  <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
                  <HumanReference />
                </group>
              </Suspense>
            </Canvas>
          </SceneErrorBoundary>
          {hideLoader && <FloatingMuteButton />}
        </div>
      </SceneContext.Provider>
    </SceneAudioProvider>
  )
}
