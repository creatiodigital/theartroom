import { AmbientLight } from './AmbientLight'
import { HDRI } from './HDRI'
import { ShadowSetup } from '@/components/scene/spaces/objects/ShadowSetup'

/**
 * The shared lighting rig. Paris and Madrid mount it from their own `lights/index`; Vienna
 * imports this file directly, so anything here applies to all three spaces.
 *
 * ❌ The ceiling skylight (`rectAreaLight`, 3×3 at [0, 3.2, 0], intensity 4.0) was REMOVED
 * 2026-09-07. It was mounted unconditionally behind an `ENABLE_AREA_LIGHTS` constant while
 * `spaceConfig` already declared `hasSkylight: false` for EVERY space — so `LightingPanel`
 * hid its control everywhere and no artist could see or adjust it, yet every visitor paid
 * for it. rectAreaLight uses the LTC approximation and is among the most expensive lights
 * per pixel in three; cost here is pixels × lights.
 *
 * It also only ever looked necessary because the environment was wrong: `scene.environment`
 * was an OUTDOOR HDR, applied per material with no occlusion test (three does not know the
 * walls exist), so a sky was lighting the interior and the fill was mistuned around it. With
 * the room environment in HDRI.tsx providing that fill correctly — one cubemap sample, no
 * per-light loop — removing the skylight cost nothing visually and returned a consistent 60
 * fps on a real 25-artwork exhibition.
 *
 * The DB columns (`skylightColor`, `skylightIntensity`) and the `hasSkylight` feature flag
 * are left in place. ⚠️ If a future space sets `hasSkylight: true`, its panel control will
 * appear with nothing behind it — re-add the light HERE, gated on `getSpaceFeatures(spaceId)
 * .hasSkylight`, not on a module constant, so the renderer and the panel cannot disagree
 * again.
 */
export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
      <ShadowSetup />
    </>
  )
}
