'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Stats } from '@react-three/drei'
import { useRef, Suspense } from 'react'
import { ReinhardToneMapping, Mesh } from 'three'

import { Loader } from '@/components/ui/Loader'
import SceneContext from '@/contexts/SceneContext'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'
import styles from './Scene.module.scss'
import { Space } from './Space'

// Temporarily disabled
const showPerfMonitor = false
// const showPerfMonitor =
//   process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' &&
//   typeof window !== 'undefined' &&
//   window.location.hostname === 'localhost'

const DrawCallLogger = () => {
  const lastLogTime = useRef(0)

  useFrame(({ gl }) => {
    const now = Date.now()
    if (now - lastLogTime.current > 2000) {
      const info = gl.info.render
      console.log(`Draw calls: ${info.calls}, Triangles: ${info.triangles.toLocaleString()}`)
      lastLogTime.current = now
    }
  })

  return null
}

export const Scene = () => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])

  const handlePlaceholderClick = (wallId: string) => {
    console.log('Clicked placeholder on wall:', wallId)
  }

  const artworks: TArtwork[] = []

  return (
    <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
      <div className={styles.scene} onContextMenu={(e) => e.preventDefault()}>
        <Canvas
          shadows
          gl={{
            antialias: true,
            toneMapping: ReinhardToneMapping,
            toneMappingExposure: 1.0,
          }}
        >
          {showPerfMonitor && (
            <>
              <Stats className="stats-panel" />
              <DrawCallLogger />
            </>
          )}
          <Suspense fallback={<Loader />}>
            <group>
              <Controls />
              <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
            </group>
          </Suspense>
        </Canvas>
      </div>
    </SceneContext.Provider>
  )
}
