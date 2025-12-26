import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Lightweight post-processing effects for enhanced visual quality.
 * 
 * IMPORTANT: Keep effects minimal for performance!
 * The gallery must run smoothly during navigation.
 * 
 * Effects are disabled by default - enable only after testing performance.
 */

interface EffectsProps {
  enabled?: boolean
}

export const Effects: React.FC<EffectsProps> = ({ enabled = false }) => {
  // Effects disabled by default for performance
  // Only enable ToneMapping which is very lightweight
  if (!enabled) return null
  
  // ToneMapping only - very lightweight, improves color response
  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  )
}

export default Effects
