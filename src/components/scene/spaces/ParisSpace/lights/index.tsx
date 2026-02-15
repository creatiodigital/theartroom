import { useSelector } from 'react-redux'

import { AmbientLight } from './AmbientLight'
import { HDRI } from './HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'
import type { RootState } from '@/redux/store'

const DEFAULT_SKYLIGHT_COLOR = '#ffffff'
const DEFAULT_SKYLIGHT_INTENSITY = 4.0

// PERF: Set to false to disable expensive area lights
const ENABLE_AREA_LIGHTS = true

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

      {/* Ceiling skylight */}
      {ENABLE_AREA_LIGHTS && (
        <rectAreaLight
          position={[0, 3.2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={3}
          height={3}
          intensity={skylightIntensity}
          color={skylightColor}
        />
      )}
    </>
  )
}
