import { EffectComposer, ToneMapping, FXAA } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Post-processing effects for enhanced visual quality.
 * - DepthOfField: Subtle bokeh blur for cinematic depth
 * - FXAA: Fast Approximate Anti-Aliasing for smooth edges
 * - Tone mapping: ACES Filmic for cinematic color grading
 */

interface EffectsProps {
  enabled?: boolean
}

export const Effects: React.FC<EffectsProps> = ({ enabled = false }) => {
  if (!enabled) return null

  return (
    <EffectComposer multisampling={0}>
      <FXAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

export default Effects
