'use client'

import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'

import { useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { Mesh } from 'three'
import { useSelector } from 'react-redux'
import { Volume2, VolumeX } from 'lucide-react'

import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { Loader } from '@/components/ui/Loader'
import {
  SceneAudioProvider,
  useSceneAudioState,
  useSceneAudioActions,
} from '@/contexts/SceneAudioContext'
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

  const [dpr, setDpr] = useState<[number, number]>([1, 2])

  // Detect device capability for antialias (can't change after context creation)
  // Conservative: only enable on devices we're SURE can handle it
  const antialias = useMemo(() => {
    if (typeof window === 'undefined') return false
    const nav = navigator as unknown as { deviceMemory?: number }
    // Only enable antialias on devices with ≥8GB memory
    // Unknown memory (Safari, Firefox) → OFF (safe default)
    return (nav.deviceMemory ?? 0) >= 8
  }, [])

  const handlePerformanceDecline = useCallback(() => {
    setDpr([1, 1.5])
  }, [])

  const handlePerformanceIncline = useCallback(() => {
    setDpr([1, 2])
  }, [])

  return (
    <SceneAudioProvider>
      <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
        <div className={styles.scene} onContextMenu={(e) => e.preventDefault()}>
          <SceneErrorBoundary exhibitionUrl={exhibitionUrl}>
            <Canvas
              shadows={false}
              dpr={dpr}
              gl={{
                antialias,
                powerPreference: 'high-performance',
              }}
            >
              <PerformanceMonitor
                onDecline={handlePerformanceDecline}
                onIncline={handlePerformanceIncline}
              />
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
