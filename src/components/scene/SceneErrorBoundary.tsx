'use client'

import * as Sentry from '@sentry/nextjs'
import { Component, type ReactNode } from 'react'

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

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            backgroundColor: '#1a1a1a',
            color: '#ffffff',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 500 }}>
            The 3D exhibition couldn&apos;t load
          </h2>
          <p style={{ color: '#999', fontSize: '0.875rem', maxWidth: '400px', lineHeight: 1.5 }}>
            Something went wrong while rendering the exhibition.
            This has been reported and we&apos;re looking into it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.625rem 1.5rem',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
