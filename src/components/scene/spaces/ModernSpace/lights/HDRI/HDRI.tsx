import { Environment } from '@react-three/drei'
import { Component, type ReactNode } from 'react'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

// Error boundary to gracefully handle HDR load failures (e.g. on mobile Safari)
class HDRIErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.warn('HDRI failed to load, falling back to no environment:', error.message)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

const HDRI = () => {
  const hdriEnvironment = useSelector(
    (state: RootState) => state.exhibition.hdriEnvironment ?? 'soil',
  )

  return (
    <HDRIErrorBoundary>
      <Environment
        key={hdriEnvironment}
        background={true}
        files={`/assets/hdri/${hdriEnvironment}.hdr`}
        environmentIntensity={0.5}
        backgroundRotation={[0, Math.PI / 1.4, 0]}
      />
    </HDRIErrorBoundary>
  )
}

export default HDRI

