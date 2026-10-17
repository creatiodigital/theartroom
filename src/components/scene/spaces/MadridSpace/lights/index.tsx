import { AmbientLight } from '@/components/scene/spaces/ParisSpace/lights/AmbientLight'
import { HDRI } from '@/components/scene/spaces/ParisSpace/lights/HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'
import { useRealismProbe } from '@/components/scene/realismProbe'
import { LoadTimeBake } from '@/components/scene/bake/LoadTimeBake'

export const Lights = () => {
  // AR-161 probe (dev-only, throwaway).
  const probe = useRealismProbe()
  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />
      {probe.enabled && probe.bake && <LoadTimeBake />}
    </>
  )
}
