import { Environment } from '@react-three/drei'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

// PERF TEST: Set to false to disable HDRI environment
const ENABLE_HDRI = true

const HDRI = () => {
  const hdriEnvironment = useSelector(
    (state: RootState) => state.exhibition.hdriEnvironment ?? 'soil',
  )

  // Skip HDRI if disabled for performance testing
  if (!ENABLE_HDRI) return null

  return (
    <Environment
      key={hdriEnvironment}
      background={true}
      files={`/assets/hdri/${hdriEnvironment}.hdr`}
      environmentIntensity={0.3}
      backgroundRotation={[0, Math.PI / 1.4, 0]}
    />
  )
}

export default HDRI
