import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

const DEFAULT_AMBIENT_COLOR = '#e4e8f2'
const DEFAULT_AMBIENT_INTENSITY = 1.0

const AmbientLight = () => {
  const ambientLightColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_AMBIENT_COLOR,
  )
  const ambientLightIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_AMBIENT_INTENSITY,
  )

  return <ambientLight color={ambientLightColor} intensity={ambientLightIntensity} />
}

export default AmbientLight
