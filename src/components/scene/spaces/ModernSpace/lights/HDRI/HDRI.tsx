import { Environment } from '@react-three/drei'

const HDRI = () => {
  return (
    <Environment
      background={true}
      files="/assets/hdri/soil.hdr"
      environmentIntensity={0.55}
      backgroundRotation={[0, Math.PI / 1.4, 0]}
    />
  )
}

export default HDRI
