import { AmbientLight } from '@/components/scene/spaces/ParisSpace/lights/AmbientLight'
import { HDRI } from '@/components/scene/spaces/ParisSpace/lights/HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'

export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />
    </>
  )
}
