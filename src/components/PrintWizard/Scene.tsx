'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'

import { Floor } from './scene/Floor'
import { PreviewArtwork } from './scene/PreviewArtwork'
import { Room } from './scene/Room'
// import { Sofa } from './scene/Sofa' — hidden for now, kept in scene/
import type { PrintConfig } from './types'

import styles from './PrintWizard.module.scss'

interface SceneProps {
  imageUrl: string
  config: PrintConfig
  /** Pixel aspect ratio of the source image — used to orient the print. */
  imageAspectRatio: number
  /** Hide the artwork + frame until a destination is chosen. */
  configReady: boolean
}

/**
 * Wizard preview canvas. Camera is roughly at gallery eye-level (y≈0) and
 * tilted slightly down so the parquet floor reads underfoot. Artwork is
 * centered at the origin on a warm-grey back wall.
 */
export const Scene = ({ imageUrl, config, imageAspectRatio, configReady }: SceneProps) => {
  return (
    <div className={styles.sceneWrapper}>
      <div className={styles.sceneCanvas}>
        {!configReady && (
          <div className={styles.scenePrompt}>
            <p className={styles.scenePromptText}>
              Pick a shipping destination to see the preview, size details and price for your print.
            </p>
          </div>
        )}
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            position: [0, -0.1, 3],
            fov: 40,
            rotation: [-0.12, 0, 0],
          }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#f7f5ef']} />

          <ambientLight intensity={1.25} />
          <directionalLight
            position={[1.5, 2, 2]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-1.5, 1, 1]} intensity={0.65} />
          <hemisphereLight args={['#ffffff', '#efeae0', 0.55]} />

          {/* Room + Floor sit OUTSIDE the Suspense: if we wrapped them
              together with PreviewArtwork, the null fallback would blank
              the whole scene every time the artwork texture reloads. */}
          <Room />
          <Floor />
          {/* <Sofa /> — hidden for now; Sofa.tsx kept in scene/ */}

          <Suspense fallback={null}>
            {configReady && (
              <PreviewArtwork
                imageUrl={imageUrl}
                config={config}
                imageAspectRatio={imageAspectRatio}
              />
            )}
          </Suspense>
        </Canvas>
      </div>
    </div>
  )
}
