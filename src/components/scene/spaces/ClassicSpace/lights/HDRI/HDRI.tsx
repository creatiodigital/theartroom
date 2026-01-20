import { Environment, useEnvironment } from '@react-three/drei'

const HDRI = () => {
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
