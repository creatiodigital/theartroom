import { Environment } from '@react-three/drei'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

const HDRI = () => {
  const hdriEnvironment = useSelector(
    (state: RootState) => state.exhibition.hdriEnvironment ?? 'soil',
  )

  return (
    <Environment
      key={hdriEnvironment}
      background={true}
      files={`/assets/hdri/${hdriEnvironment}.hdr`}
      environmentIntensity={0.5}
      backgroundRotation={[0, Math.PI / 1.4, 0]}
    />
  )
}

export default HDRI
