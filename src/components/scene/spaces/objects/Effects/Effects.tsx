// @ts-expect-error N8AO kept for future use (currently commented out in JSX)
import { EffectComposer, ToneMapping, FXAA, N8AO } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Post-processing effects for enhanced visual quality.
 * - N8AO: Ground-Truth Ambient Occlusion for contact shadows and depth
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
      {/* N8AO disabled — too expensive, causes FPS drops
      <N8AO
        aoRadius={0.15}
        intensity={0.2}
        distanceFalloff={0.2}
        quality="low"
        halfRes
      />
      */}
      <FXAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

export default Effects
