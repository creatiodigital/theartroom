import { AmbientLight } from '@/components/scene/spaces/ParisSpace/lights/AmbientLight'
import { HDRI } from '@/components/scene/spaces/ParisSpace/lights/HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'
import { RoomBake } from '@/components/scene/bake/RoomBake'

export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />
      {/* AR-161: the stored bake, or the admin's bake (bake mode). */}
      <RoomBake />
    </>
  )
}
