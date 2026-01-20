import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Lightweight post-processing effects for enhanced visual quality.
 * 
 * Note: SSR (Screen Space Reflections) would require upgrading @react-three/postprocessing
 * or installing screen-space-reflections package separately.
 */

interface EffectsProps {
  enabled?: boolean
}

export const Effects: React.FC<EffectsProps> = ({ enabled = false }) => {
  if (!enabled) return null

  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

export default Effects
