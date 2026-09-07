import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'

const DEFAULT_AMBIENT_COLOR = '#e4e8f2'
const DEFAULT_AMBIENT_INTENSITY = 1.0

/**
 * EXPERIMENT 2026-09-07 — is ambient double-counting what the environment now provides?
 * Set both to null to restore the stored values exactly.
 *
 * `ambientLight` is the least physical light in three: a flat term added to every surface
 * regardless of which way it faces. It is a crude stand-in for precisely what an environment
 * map does properly, and these values were tuned when `scene.environment` was an OUTDOOR HDR
 * lighting the interior through walls three does not know about (see HDRI.tsx).
 *
 * Two separate suspicions:
 *   - INTENSITY 1.0 both double-counts the environment's fill AND flattens the room, because
 *     a flat add compresses the difference between up-facing and down-facing surfaces — the
 *     main cue that a space reads as three-dimensional.
 *   - COLOUR #e4e8f2 is a cool blue-grey, i.e. a DAYLIGHT tint. That followed from the sky
 *     that used to light the room. Against a synthetic white gallery it is a leftover.
 *
 * ⚠️ Unlike the skylight (removed the same day — `spaceConfig` already said no space had one),
 * this light IS artist-controllable and stored per exhibition. So these overrides exist to
 * judge the look on a REAL show, whose stored values would otherwise win. Changing the
 * defaults below would only affect exhibitions that never set a value; anything published
 * carries its own and would need a data decision, not a code change.
 *
 * ⚠️ Overrides the LIGHT only. `useAmbientLight` also reads these columns to tint materials
 * (lamp bodies, plaster), and that path is deliberately untouched here so this experiment
 * changes one thing.
 */
// NULL = the artist's stored value wins. Do NOT ship a number here: it bypasses every
// exhibition's authored setting, including published ones.
//
// Findings from the 2026-09-07 session, for whoever picks this up:
//   - 0.3 was clearly TOO DARK, and the CEILING gave it away. Every spotlight points down at
//     a wall, so nothing in the scene lights the ceiling and ambient was carrying it nearly
//     alone. The room environment cannot take that over either: a ceiling faces DOWNWARD, so
//     what it samples is the floor Lightformer in HDRI.tsx, deliberately dark at 0.12.
//   - 0.6 was the next value to try and was never judged.
//   - 🔑 The better fix is probably NOT here. In a real gallery the ceiling is lit by bounce
//     off the floor. Raising the environment's floor Lightformer (0.12 → ~0.25) would light
//     downward-facing surfaces specifically — ceiling, undersides of frames, tops of
//     radiators — where flat ambient lifts everything equally and flattens the room. Try that
//     BEFORE lowering ambient again, and change one at a time.
const AMBIENT_INTENSITY_OVERRIDE: number | null = null
// Also null. #e4e8f2 (the default) is a cool DAYLIGHT tint that followed from the outdoor HDR
// which used to light the interior; against a synthetic white gallery it may now be a
// leftover. Untested — white was set during the session but never judged separately from the
// intensity change.
const AMBIENT_COLOR_OVERRIDE: string | null = null

const AmbientLight = () => {
  const ambientLightColor = useSelector(
    (state: RootState) => state.exhibition.ambientLightColor ?? DEFAULT_AMBIENT_COLOR,
  )
  const ambientLightIntensity = useSelector(
    (state: RootState) => state.exhibition.ambientLightIntensity ?? DEFAULT_AMBIENT_INTENSITY,
  )

  return (
    <ambientLight
      color={AMBIENT_COLOR_OVERRIDE ?? ambientLightColor}
      intensity={AMBIENT_INTENSITY_OVERRIDE ?? ambientLightIntensity}
    />
  )
}

export default AmbientLight
