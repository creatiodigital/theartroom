import { Environment, useEnvironment } from '@react-three/drei'

// PERF TEST: Set to false to disable HDRI environment
const ENABLE_HDRI = true

const HDRI = () => {
  // Skip HDRI if disabled for performance testing
  if (!ENABLE_HDRI) return null
  
  // Preload the HDR - this will suspend until loaded
  const envMap = useEnvironment({ files: '/assets/hdri/soil.hdr' })

  return (
    <Environment
      background={true}
      map={envMap}
      environmentIntensity={0.3}
      backgroundRotation={[0, Math.PI / 1.4, 0]}
    />
  )
}

export default HDRI
