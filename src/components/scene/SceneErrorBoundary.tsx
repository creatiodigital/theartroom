'use client'

import * as Sentry from '@sentry/nextjs'
import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'

import styles from './SceneErrorBoundary.module.scss'

interface Props {
  children: ReactNode
  exhibitionId?: string
  exhibitionUrl?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary specifically for the 3D exhibition scene.
 * Captures Three.js/WebGL crashes and reports them to Sentry
 * with exhibition context.
 */
export class SceneErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope((scope) => {
      scope.setTag('component', '3d-scene')
      scope.setTag('exhibition.id', this.props.exhibitionId || 'unknown')
      scope.setTag('exhibition.url', this.props.exhibitionUrl || 'unknown')
      scope.setContext('react', {
        componentStack: errorInfo.componentStack,
      })
      scope.setContext('webgl', {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        gpu: this.getGPUInfo(),
      })
      scope.setLevel('fatal')
      Sentry.captureException(error)
    })
  }

  private getGPUInfo(): string {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info')
        if (ext) {
          return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown'
        }
      }
    } catch {
      // ignore
    }
    return 'unknown'
  }

  private isNetworkBlockedError(): boolean {
    const msg = this.state.error?.message?.toLowerCase() || ''
    return msg.includes('403') || msg.includes('forbidden') || msg.includes('blocked')
  }

  render() {
    if (this.state.hasError) {
      const isNetworkBlocked = this.isNetworkBlockedError()

      return (
        <div className={styles.container}>
          <h2 className={styles.title}>
            {isNetworkBlocked
              ? 'The exhibition could not be loaded'
              : "The 3D exhibition couldn't load"}
          </h2>
          <p className={styles.message}>
            {isNetworkBlocked
              ? 'Your network appears to be blocking files required for the 3D exhibition. This can happen on corporate or restricted networks. Please try again from a different network or device.'
              : "Something went wrong while rendering the exhibition. This has been reported and we're looking into it."}
          </p>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            label={isNetworkBlocked ? 'Try again' : 'Reload page'}
            className={styles.retryButton}
          />
        </div>
      )
    }

    return this.props.children
  }
}
