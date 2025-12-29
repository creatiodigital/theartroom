import { AmbientLight } from './AmbientLight'
// import { AreaLight } from './AreaLight'
import { HDRI } from './HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'

export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />
      {/* <AreaLight /> */}
    </>
  )
}
