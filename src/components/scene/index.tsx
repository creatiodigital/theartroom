'use client'

import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'

import { useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { Mesh } from 'three'
import { useSelector } from 'react-redux'
import { Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { ICON_STROKE_WIDTH } from '@/lib/iconConfig'
import { Loader } from '@/components/ui/Loader'
import {
  SceneAudioProvider,
  useSceneAudioState,
  useSceneAudioActions,
} from '@/contexts/SceneAudioContext'
import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import Controls from './controls'

import { SceneErrorBoundary } from './SceneErrorBoundary'
import styles from './Scene.module.scss'
import { Space } from './Space'
import { WebGLMonitor } from './WebGLMonitor'

// Adaptive resolution ladder. Fill rate is this scene's only real budget — cost
// is pixels × lights, and every pixel evaluates all 22 spotlights in three's
// forward renderer, so dpr is the single biggest lever we have. (Measured
// 2026-09-06: a flat cap of 1.5 took a real 25-artwork show from 42-45 fps to a
// locked 60. Triangles, frames and texture memory were all measured and ruled
// out — do not go hunting there.)
//
// That flat cap was deliberately temporary. It left capable machines pinned to a
// resolution they did not need, and it is the dominant term in the distant-text
// shimmer: at 1.5 a far-away glyph stroke lands under one output pixel, so
// walking toward a wall label makes it crawl. The ceiling is adaptive again and
// `PerformanceMonitor` decides — climb where the frame budget allows, fall where
// it does not, starting from the resolution we know is safe.
//
// ⚠️ GLOBAL: every space, every retina visitor. Non-retina users are at dpr 1
// already and are unaffected by any of this.
// The floor is 1.5 and there is deliberately NOTHING below it: 1.5 is the value
// measured to hold a locked 60 fps on a real 25-artwork show, and going lower
// buys framerate we do not need at the direct cost of text legibility. Worst
// case this ladder degrades to exactly what we shipped before it existed.
const DPR_STEPS = [1.5, 1.75, 2] as const

// Start at the floor and let the hardware earn the climb.
const DPR_START_STEP = 0

interface SceneProps {
  hideLoader?: boolean
}

const FloatingMuteButton = () => {
  const { hasActiveAudio, isMuted } = useSceneAudioState()
  const { toggleMute } = useSceneAudioActions()

  if (!hasActiveAudio) return null

  return (
    <Button
      variant="ghost"
      onClick={toggleMute}
      className={styles.stopButton}
      title={isMuted ? 'Unmute sound' : 'Mute sound'}
      aria-pressed={isMuted}
    >
      {isMuted ? (
        <VolumeX size={20} strokeWidth={ICON_STROKE_WIDTH} />
      ) : (
        <Volume2 size={20} strokeWidth={ICON_STROKE_WIDTH} />
      )}
    </Button>
  )
}

export const Scene = ({ hideLoader }: SceneProps = {}) => {
  const wallRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const windowRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const glassRefs = useRef<React.RefObject<Mesh | null>[]>([])
  const exhibitionUrl = useSelector((state: RootState) => state.exhibition.url)

  const handlePlaceholderClick = (_wallId: string) => {
    // Placeholder click handler - used by Space component
  }

  const artworks: TArtwork[] = []

  const [dprStep, setDprStep] = useState(DPR_START_STEP)

  // Set once `onFallback` fires: the ladder has found this machine's limit, so
  // further incline/decline signals are ignored rather than resuming the churn.
  const [ladderLocked, setLadderLocked] = useState(false)
  const dpr = useMemo<[number, number]>(() => [1, DPR_STEPS[dprStep]], [dprStep])

  const handlePerformanceDecline = useCallback(() => {
    if (ladderLocked) return
    setDprStep((step) => Math.max(0, step - 1))
  }, [ladderLocked])

  const handlePerformanceIncline = useCallback(() => {
    if (ladderLocked) return
    setDprStep((step) => Math.min(DPR_STEPS.length - 1, step + 1))
  }, [ladderLocked])

  // drei's default bounds are `[50, refreshRate]`, and `onIncline` only fires
  // when the AVERAGE fps exceeds the upper bound. On a vsync-capped display the
  // average can never exceed the refresh rate, so with the defaults the ladder
  // can only ever fall — the ceiling is unreachable by construction, and the
  // HUD sits at the floor reading a healthy 57 avg forever.
  //
  // So we infer headroom instead of measuring it: being pinned AT the cap means
  // frames are finishing early enough to spend the slack on pixels.
  //
  // The band is deliberately tight and high — 60 Hz → climb above ~58, fall
  // below ~57. A wider one lets the ladder park at a resolution it cannot hold:
  // measured 2026-09-07, bounds of [50, 55] left it sitting at dpr 2 averaging
  // 52 fps, above the decline threshold and therefore never stepping back. On a
  // vsync-capped display 52 fps is not "slightly slower", it is roughly one
  // dropped frame in six at irregular intervals, which reads as judder while
  // walking — worse than the locked 60 one step down. Anything short of the cap
  // means we have overspent, so give the step back.
  //
  // Tightness does not cause churn here: `flipflops` + `onFallback` turn the
  // oscillation into a hill-climb that settles on the highest step that HOLDS.
  //
  // The floor is 0.93 (≈56 fps on 60 Hz) rather than 0.95 (57). 0.95 was too
  // strict once the scene grew: measured 2026-09-07 on a real 25-artwork show
  // with bloom, reflections, MSAA and the room environment all on, the average
  // sits at 57 — exactly ON a 0.95 bound, so a 1 fps wobble would demote a step
  // and `flipflops` could then pin it there. 0.93 rides out that wobble while
  // still catching a genuine drop. Eduardo's call: 57 on the heaviest show is
  // acceptable, so holding resolution through it is the behaviour he wants.
  const performanceBounds = useCallback((refreshRate: number): [number, number] => {
    const cap = refreshRate > 0 ? refreshRate : 60
    return [cap * 0.93, cap * 0.97]
  }, [])

  // Called once PerformanceMonitor has seen `flipflops` oscillations: the machine
  // cannot hold the step it keeps reaching for, so stop moving and settle.
  //
  // Settle ONE STEP DOWN from wherever we are — not at the floor. A machine that
  // holds 1.75 comfortably but cannot sustain 2 will oscillate at the top, and
  // pinning it to the floor would confiscate a step it had already earned: the
  // HUD then reads a healthy average at the lowest resolution, which looks like
  // "no headroom" when the truth is "one step less than it asked for".
  //
  // Locking matters because every dpr change reallocates the composer's MSAA
  // render targets — thrashing costs more than the resolution is worth.
  const handlePerformanceFallback = useCallback(() => {
    setDprStep((step) => Math.max(0, step - 1))
    setLadderLocked(true)
  }, [])

  return (
    <SceneAudioProvider>
      <SceneContext.Provider value={{ wallRefs, windowRefs, glassRefs }}>
        <div className={styles.scene} onContextMenu={(e) => e.preventDefault()}>
          <SceneErrorBoundary exhibitionUrl={exhibitionUrl}>
            <Canvas
              shadows={false}
              dpr={dpr}
              gl={{
                // Intentionally off, and inert either way: `Effects` mounts an
                // EffectComposer in every space, which renders the scene into
                // its own offscreen target — so the default framebuffer's MSAA
                // is never what you see. Antialiasing is configured by the
                // composer's `multisampling` prop, not here. Leaving this false
                // avoids allocating a multisampled framebuffer nothing samples.
                antialias: false,
                powerPreference: 'high-performance',
              }}
            >
              <WebGLMonitor exhibitionUrl={exhibitionUrl} />
              <Suspense fallback={hideLoader ? null : <Loader />}>
                {/* INSIDE Suspense on purpose. Mounted outside it, this samples
                    the loading frames — GLB parse, KTX2 upload and ~19 shader
                    programs compiling all land in the same window — sees a
                    single-digit average before the scene has rendered once, and
                    immediately declines. With `flipflops` that verdict is
                    permanent: `onFallback` pins the floor and it can never
                    climb. Suspense delays it until the assets have resolved. */}
                <PerformanceMonitor
                  bounds={performanceBounds}
                  onDecline={handlePerformanceDecline}
                  onIncline={handlePerformanceIncline}
                  flipflops={3}
                  onFallback={handlePerformanceFallback}
                />
                <group>
                  <Controls />
                  <Space onPlaceholderClick={handlePlaceholderClick} artworks={artworks} />
                </group>
              </Suspense>
            </Canvas>
          </SceneErrorBoundary>
          {hideLoader && <FloatingMuteButton />}
        </div>
      </SceneContext.Provider>
    </SceneAudioProvider>
  )
}
