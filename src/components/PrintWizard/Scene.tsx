'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'

import type { Catalog, WizardConfig } from '@/lib/print-providers'

import { Floor } from './scene/Floor'
import { PreviewArtwork } from './scene/PreviewArtwork'
import { Room } from './scene/Room'

import styles from './PrintWizard.module.scss'

interface SceneProps {
  imageUrl: string
  catalog: Catalog
  config: WizardConfig
  imageAspectRatio: number
  /** Hide the artwork + frame until a destination is chosen. */
  configReady: boolean
}

export const Scene = ({ imageUrl, catalog, config, imageAspectRatio, configReady }: SceneProps) => {
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

          <Room />
          <Floor />

          <Suspense fallback={null}>
            {configReady && (
              <PreviewArtwork
                imageUrl={imageUrl}
                catalog={catalog}
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
