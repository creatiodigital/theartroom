import { useSelector } from 'react-redux'

import { AmbientLight } from './AmbientLight'
import { HDRI } from './HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'
import type { RootState } from '@/redux/store'

const DEFAULT_SKYLIGHT_COLOR = '#ffffff'
const DEFAULT_SKYLIGHT_INTENSITY = 4.0

export const Lights = () => {
  const skylightColor = useSelector(
    (state: RootState) => state.exhibition.skylightColor ?? DEFAULT_SKYLIGHT_COLOR,
  )
  const skylightIntensity = useSelector(
    (state: RootState) => state.exhibition.skylightIntensity ?? DEFAULT_SKYLIGHT_INTENSITY,
  )

  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />

      {/* Single large skylight - simulates light through glass ceiling */}
      <rectAreaLight
        position={[0, 9, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={12}
        height={8}
        intensity={skylightIntensity}
        color={skylightColor}
      />
    </>
  )
}
