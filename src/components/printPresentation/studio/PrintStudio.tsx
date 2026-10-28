'use client'

/**
 * The print-presentation studio: one artwork's SURROUND, shot straight on against a light gray
 * wall — a wooden frame (open editions, works not for sale) or an unframed sheet with a pencilled
 * "copy/N" (limited editions), with their soft shadows. Rendered in the admin's browser, captured,
 * and stored; public pages show the stored image. See
 * docs/superpowers/specs/2026-10-28-print-presentations-design.md.
 *
 * 🔒 The artwork itself is NEVER in the render: where it would be, the shot is transparent
 * (`ArtworkWindow`). The page lays the original file underneath, in that window, so the image is
 * never lit, shadowed, resampled by the renderer or re-encoded.
 *
 * 🔒 The look was approved by the owner (2026-10-28). Its values live in
 * `src/lib/printPresentation/look.ts` and `geometry.ts`; don't retune them here.
 */
import { SoftShadows } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PerspectiveCamera } from 'three'

import {
  WALL_COLOR,
  WALL_IRRADIANCE,
  shotFrame,
  windowFractions,
  type ShotFrame,
  type PresentationWindow,
} from '@/lib/printPresentation/geometry'
import {
  frameOrDefault,
  makeLook,
  type Look,
  type PresentationFrame,
  type PresentationMode,
  type Vec3,
} from '@/lib/printPresentation/look'

import type { WindowRectPx } from './ArtworkWindow'
import { Limited } from './PaperSheet'
import { Framed } from './StudioFrame'

/** A finished shot: its canvas, and where the artwork's window is in it. */
export type StudioShot = { canvas: HTMLCanvasElement; window: PresentationWindow }

/** Frames rendered after everything has loaded before the shot is taken. */
const SETTLE_FRAMES = 3

/**
 * A key light from the upper left and two faint fills from below and the right, so the piece's top
 * and left edges carry a whisper of shadow too — the light all around a print in a real photo. The
 * hemisphere gives the rest. Each light is set by its SHARE of what the wall receives, and the shares
 * always add up to WALL_IRRADIANCE: whatever the seed, the wall is the same white.
 */
const Lights = ({ look }: { look: Look }) => {
  // A directional light's irradiance on the wall (normal +z) is intensity × cos(angle).
  const intensity = ([x, y, z]: Vec3, share: number) =>
    (share * WALL_IRRADIANCE) / (z / Math.hypot(x, y, z))
  const shadowed = [
    { position: look.key, share: look.keyShare, map: 4096 },
    ...look.fills.map((f) => ({ ...f, map: 2048 })),
  ]
  const hemisphere = WALL_IRRADIANCE * (1 - shadowed.reduce((sum, l) => sum + l.share, 0))
  return (
    <>
      {/* Wide penumbras (a graded falloff, not a gray band); many samples keep them free of grain. */}
      <SoftShadows size={look.softness} samples={128} focus={0.35} />
      <hemisphereLight args={['#ffffff', '#ffffff', hemisphere]} />
      {shadowed.map((l, i) => (
        <directionalLight
          key={i}
          position={l.position}
          intensity={intensity(l.position, l.share)}
          castShadow
          shadow-mapSize={[l.map, l.map]}
          shadow-bias={-0.0004}
          shadow-camera-left={-1.5}
          shadow-camera-right={1.5}
          shadow-camera-top={1.5}
          shadow-camera-bottom={-1.5}
          shadow-camera-near={0.1}
          shadow-camera-far={8}
        />
      ))}
    </>
  )
}

/**
 * Points the camera at the shot: the canvas's proportions. Set before anything is drawn or
 * projected (a layout effect, ahead of every other component's effects).
 */
const ShotCamera = ({ shot }: { shot: ShotFrame }) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  useLayoutEffect(() => {
    camera.aspect = shot.widthPx / shot.heightPx
    camera.updateProjectionMatrix()
  }, [camera, shot])
  return null
}

/**
 * Mounted once everything has loaded: asks for a few frames, then hands over the shot. The canvas
 * draws only on demand — a still life needs no animation loop, and a continuous one at this size
 * and shadow quality would keep the GPU busy and the page unresponsive.
 */
const TakeShot = ({
  windowRect,
  onShot,
}: {
  windowRect: React.RefObject<WindowRectPx | null>
  onShot: (shot: StudioShot) => void
}) => {
  const { gl, size, invalidate } = useThree()
  const frames = useRef(0)
  const taken = useRef(false)
  useEffect(() => invalidate(), [invalidate])
  useFrame(() => {
    frames.current += 1
    const rect = windowRect.current
    if (taken.current) return
    if (frames.current < SETTLE_FRAMES || !rect) {
      invalidate()
      return
    }
    taken.current = true
    onShot({ canvas: gl.domElement, window: windowFractions(rect, size.width, size.height) })
  })
  return null
}

export function PrintStudio({
  ratio,
  mode,
  edition,
  frame,
  seed,
  widthPx,
  onReady,
}: {
  ratio: number
  mode: PresentationMode
  /** Limited only: N in the pencilled "copy/N". */
  edition: number | null
  /** Framed only: the frame it's rendered in. */
  frame: PresentationFrame | null
  seed: number
  widthPx: number
  /** Called once, when the shot is ready to capture. */
  onReady: (shot: StudioShot) => void
}) {
  if (mode === 'limited' && edition === null) {
    throw new Error('PrintStudio: a limited edition needs its edition size')
  }
  // `edition` only feeds the copy number, which only a limited sheet shows; the draw happens
  // either way, so every value after it stays where it was approved.
  const look = useMemo(() => makeLook(seed, mode, edition ?? 1), [seed, mode, edition])
  const shot = useMemo(() => shotFrame(mode, ratio, widthPx, look), [mode, ratio, widthPx, look])

  const windowRect = useRef<WindowRectPx | null>(null)
  const onWindow = useCallback((rect: WindowRectPx) => {
    windowRect.current = rect
  }, [])
  const [numberDrawn, setNumberDrawn] = useState(mode !== 'limited')
  const onNumberDrawn = useCallback(() => setNumberDrawn(true), [])

  const ready = useRef(onReady)
  useEffect(() => {
    ready.current = onReady
  }, [onReady])
  const onShot = useCallback((shot: StudioShot) => ready.current(shot), [])

  return (
    <div style={{ width: widthPx, height: shot.heightPx }}>
      <Canvas
        frameloop="demand"
        flat
        shadows
        dpr={1}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{
          position: [0, 0, shot.distance],
          fov: shot.fov,
          near: 0.05,
          far: 50,
          manual: true,
        }}
      >
        <ShotCamera shot={shot} />
        <Lights look={look} />
        {/* The wall: big, light gray, matte. */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={1} />
        </mesh>
        <Suspense fallback={null}>
          <group
            onUpdate={(g) =>
              g.traverse((o) => {
                // Everything casts and takes shadows except the artwork's window, which isn't a
                // thing in the room, and what opts out (the pencil; the sheet onto itself).
                const solid = !o.userData.artworkWindow && !o.userData.noShadow
                o.castShadow = solid
                o.receiveShadow = solid && !o.userData.noReceive
              })
            }
          >
            {mode === 'limited' ? (
              <Limited
                ratio={ratio}
                edition={edition as number}
                look={look}
                onWindow={onWindow}
                onNumberDrawn={onNumberDrawn}
              />
            ) : (
              <Framed ratio={ratio} frame={frameOrDefault(frame)} look={look} onWindow={onWindow} />
            )}
          </group>
          {numberDrawn && <TakeShot windowRect={windowRect} onShot={onShot} />}
        </Suspense>
      </Canvas>
    </div>
  )
}
