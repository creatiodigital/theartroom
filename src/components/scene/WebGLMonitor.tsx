'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Invisible R3F component that monitors WebGL context loss/restore
 * and reports to Sentry. Must be placed inside the Canvas.
 */
export function WebGLMonitor({ exhibitionUrl }: { exhibitionUrl?: string }) {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const canvas = gl.domElement

    const handleContextLost = (event: Event) => {
      event.preventDefault() // Allow WebGL to attempt restore

      Sentry.withScope((scope) => {
        scope.setTag('component', '3d-scene')
        scope.setTag('error.type', 'webgl-context-lost')
        scope.setTag('exhibition.url', exhibitionUrl || 'unknown')
        scope.setLevel('error')
        Sentry.captureMessage('WebGL context lost — 3D exhibition crashed', 'error')
      })
    }

    const handleContextRestored = () => {
      Sentry.captureMessage('WebGL context restored — 3D exhibition recovered', 'info')
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [gl, exhibitionUrl])

  return null
}
