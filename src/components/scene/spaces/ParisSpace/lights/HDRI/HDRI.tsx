import { Environment, Lightformer, useEnvironment } from '@react-three/drei'
import { Component, type ReactNode } from 'react'
import { useSelector } from 'react-redux'

import type { RootState } from '@/redux/store'
import { assetUrl } from '@/lib/assetUrl'

// PERF TEST: Set to false to disable HDRI environment
const ENABLE_HDRI = true

/**
 * EXPERIMENT 2026-09-07 — reflect the ROOM, not the outdoors. Revert = set to false.
 *
 * The environment map is what every non-metal surface samples for its specular highlight:
 * the floor's sheen, the frames, the radiators, the window glass. Until now that map was
 * `soil.hdr` — an outdoor capture — so every reflective surface in a white gallery was
 * reflecting a landscape that is nowhere in the scene. Physically wrong, and wrong in a way
 * the eye registers without being able to name it.
 *
 * drei cannot capture the real scene into an env map (passing children routes `<Environment>`
 * through EnvironmentPortal, which renders THOSE CHILDREN, not the room). So we approximate
 * the room with Lightformers: a bright ceiling, white walls, a dark floor. That is what a
 * gallery actually looks like from the point of view of a reflective surface.
 *
 * `frames={1}` renders the portal ONCE into a 256² cubemap, so the per-frame cost is zero —
 * the opposite of the AO experiment, which was rejected for costing a resolution step. It
 * also removes an HDR download from the load path.
 *
 * The file HDR is kept for the BACKGROUND (`background="only"`) — that is what a visitor sees
 * through the windows, where an outdoor image is exactly right.
 */
const ENABLE_ROOM_ENVIRONMENT = true

/**
 * Raised from the 0.3 used with `soil.hdr`. That value was low partly because the content was
 * wrong — an outdoor HDR indoors has to be dialled down before it stops looking odd. A
 * physically plausible interior can carry more, which is what gives frames and floor their
 * grounding. Turn it down if surfaces start to look washed out rather than lit.
 */
const ROOM_ENV_INTENSITY = 0.6
const DEFAULT_HDRI_ROTATION = 128 // degrees
const AVAILABLE_HDRIS = ['soil'] as const

// Preload default HDRI at module scope to avoid Loader setState-during-render warnings
useEnvironment.preload({ files: assetUrl('/assets/hdri/soil.hdr') })

// Error boundary to gracefully handle HDR load failures (e.g. on mobile Safari)
class HDRIErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.warn('HDRI failed to load, falling back to no environment:', error.message)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

const HDRI = () => {
  const rawHdri = useSelector((state: RootState) => state.exhibition.hdriEnvironment ?? 'soil')
  // Fallback to 'soil' if the stored HDRI no longer exists
  const hdriEnvironment = AVAILABLE_HDRIS.includes(rawHdri as (typeof AVAILABLE_HDRIS)[number])
    ? rawHdri
    : 'soil'
  const windowTransparency = useSelector(
    (state: RootState) => state.exhibition.windowTransparency ?? false,
  )
  const hdriRotation = useSelector(
    (state: RootState) => state.exhibition.hdriRotation ?? DEFAULT_HDRI_ROTATION,
  )

  // Skip HDRI if disabled for performance testing
  if (!ENABLE_HDRI) return null

  const rotationRadians = (hdriRotation * Math.PI) / 180

  if (ENABLE_ROOM_ENVIRONMENT) {
    return (
      <HDRIErrorBoundary>
        {/* Reflections: a synthetic white room. Not visible in the scene — Lightformers live
            in the portal scene that is rendered into the cubemap, never in the gallery. */}
        <Environment frames={1} resolution={256} environmentIntensity={ROOM_ENV_INTENSITY}>
          {/* Ceiling: the dominant source in a gallery, and the reason a polished floor
              reads bright rather than mirror-dark. */}
          <Lightformer
            form="rect"
            intensity={1.0}
            scale={[12, 12, 1]}
            position={[0, 4, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            color="#ffffff"
          />
          {/* Four walls. White walls bounce most of the light in a room like this, so they
              carry real weight rather than being a rim detail. */}
          <Lightformer
            form="rect"
            intensity={0.55}
            scale={[12, 4, 1]}
            position={[0, 1.5, -6]}
            color="#ffffff"
          />
          <Lightformer
            form="rect"
            intensity={0.55}
            scale={[12, 4, 1]}
            position={[0, 1.5, 6]}
            rotation={[0, Math.PI, 0]}
            color="#ffffff"
          />
          <Lightformer
            form="rect"
            intensity={0.55}
            scale={[12, 4, 1]}
            position={[-6, 1.5, 0]}
            rotation={[0, Math.PI / 2, 0]}
            color="#ffffff"
          />
          <Lightformer
            form="rect"
            intensity={0.55}
            scale={[12, 4, 1]}
            position={[6, 1.5, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            color="#ffffff"
          />
          {/* Floor: dark and slightly warm, standing in for the parquet. Without it the
              underside of every frame reflects white and the room loses its floor. */}
          <Lightformer
            form="rect"
            intensity={0.12}
            scale={[12, 12, 1]}
            position={[0, -1.5, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            color="#6b5a4a"
          />
        </Environment>

        {/* Background stays the real HDR: this is what shows THROUGH the windows, where an
            outdoor image is correct. `background="only"` keeps it from touching reflections. */}
        {windowTransparency && (
          <Environment
            key={`bg-${hdriEnvironment}`}
            background="only"
            files={assetUrl(`/assets/hdri/${hdriEnvironment}.hdr`)}
            backgroundRotation={[0, rotationRadians, 0]}
          />
        )}
      </HDRIErrorBoundary>
    )
  }

  return (
    <HDRIErrorBoundary>
      <Environment
        key={hdriEnvironment}
        background={windowTransparency}
        files={assetUrl(`/assets/hdri/${hdriEnvironment}.hdr`)}
        environmentIntensity={0.3}
        backgroundRotation={[0, rotationRadians, 0]}
      />
    </HDRIErrorBoundary>
  )
}

export default HDRI
