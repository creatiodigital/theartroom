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

      {/* Area lights - disabled for performance by default */}
      {ENABLE_AREA_LIGHTS && (
        <>
          <rectAreaLight
            position={[0, 9, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={12}
            height={8}
            intensity={skylightIntensity}
            color={skylightColor}
          />
          <rectAreaLight
            position={[-8, 3, 0]}
            rotation={[0, Math.PI / 2, 0]}
            width={4}
            height={3}
            intensity={skylightIntensity * 0.5}
            color={skylightColor}
          />
          <rectAreaLight
            position={[8, 3, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            width={4}
            height={3}
            intensity={skylightIntensity * 0.5}
            color={skylightColor}
          />
        </>
      )}
    </>
  )
}

