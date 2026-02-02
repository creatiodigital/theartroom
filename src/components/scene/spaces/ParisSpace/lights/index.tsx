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

      {/* Area lights - positioned for the Paris space */}
      {ENABLE_AREA_LIGHTS && (
        <>
          {/* Ceiling skylight */}
          <rectAreaLight
            position={[0, 3.2, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={3}
            height={3}
            intensity={skylightIntensity}
            color={skylightColor}
          />
          {/* Window light - simulates daylight through window */}
          <rectAreaLight
            position={[-3, 1.5, -6.5]}
            rotation={[0, 0, 0]}
            width={1.2}
            height={2.5}
            intensity={skylightIntensity * 0.8}
            color={skylightColor}
          />
        </>
      )}
    </>
  )
}
