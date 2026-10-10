'use client'

import { Button } from '@/components/ui/Button'

import styles from './SceneErrorBoundary.module.scss'

/**
 * Shown instead of the 3D scene when the browser cannot create a WebGL context
 * (GPU blocklisted, hardware acceleration switched off, no GPU at all).
 * Deliberately NOT reported to Sentry: it is a property of the visitor's
 * device, not a bug, and headless crawlers on GPU-less servers hit it daily.
 */
export const WebGLUnavailable = () => (
  <div className={styles.container}>
    <h2 className={styles.title}>Your browser can&apos;t display this 3D exhibition</h2>
    <p className={styles.message}>
      3D graphics are unavailable on this device. Turning on hardware acceleration in your browser
      settings, or opening the exhibition in another browser or on another device, usually fixes it.
    </p>
    <Button
      variant="secondary"
      onClick={() => window.location.reload()}
      label="Try again"
      className={styles.retryButton}
    />
  </div>
)
