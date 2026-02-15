import { Environment } from '@react-three/drei'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

// PERF TEST: Set to false to disable HDRI environment
const ENABLE_HDRI = true
const DEFAULT_HDRI_ROTATION = 128 // degrees
const AVAILABLE_HDRIS = ['soil'] as const

const HDRI = () => {
  const rawHdri = useSelector((state: RootState) => state.exhibition.hdriEnvironment ?? 'soil')
  // Fallback to 'soil' if the stored HDRI no longer exists
  const hdriEnvironment = AVAILABLE_HDRIS.includes(rawHdri as (typeof AVAILABLE_HDRIS)[number])
    ? rawHdri
    : 'soil'
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  const hdriRotation = useSelector(
    (state: RootState) => state.exhibition.hdriRotation ?? DEFAULT_HDRI_ROTATION,
  )

  // Skip HDRI if disabled for performance testing
  if (!ENABLE_HDRI) return null

  const rotationRadians = (hdriRotation * Math.PI) / 180

  return (
    <Environment
      key={hdriEnvironment}
      background={windowTransparency}
      files={`/assets/hdri/${hdriEnvironment}.hdr`}
      environmentIntensity={0.3}
      backgroundRotation={[0, rotationRadians, 0]}
    />
  )
}

export default HDRI
