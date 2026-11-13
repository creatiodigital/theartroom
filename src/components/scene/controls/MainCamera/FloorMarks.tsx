'use client'

import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Cursor, MouseSimple } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, MeshBasicMaterial, RingGeometry, type Mesh, type Vector3 } from 'three'

import SlideHorizontal from '@/icons/gesture-slide-horizontal.svg'
import Tap from '@/icons/gesture-tap.svg'

import { FLOOR_Y, MARKER_FADE_S, SHOW_FLOOR_RINGS } from './navigation'
import styles from './FloorMarks.module.scss'

/**
 * The rings on the floor: where a tap or click is walking to (a breath of a ring, gone in
 * `MARKER_FADE_S`), where a click would walk to under the mouse (laptops and desktops), both off
 * for now (`SHOW_FLOOR_RINGS`); and, on every entry, a slow pulse a little way ahead under a word
 * on how to walk, each line beside its gesture, acted out. Thin, white and quiet, like a mark on a
 * gallery floor, never a game's target.
 */

/** Written by MainCamera, read here every frame. */
export type FloorMarksState = {
  /** A walk's destination and when it was set (s, the scene clock); null once faded. */
  tap: { x: number; z: number; at: number } | null
  /** Under the mouse, where a click would walk to; null over a work, or off the room. */
  hover: { x: number; z: number } | null
}

export const createFloorMarks = (): FloorMarksState => ({ tap: null, hover: null })

/** A gesture the entry hint acts out beside its words: a finger's or the mouse's. */
export type HintGesture = 'tap' | 'click' | 'drag-finger' | 'drag-mouse'

/** The entry hint, while it shows: its spot on the floor and its lines; `leaving` as it fades. */
export type WalkHint = {
  x: number
  z: number
  lines: { gesture: HintGesture; text: string }[]
  leaving?: boolean
}

/**
 * A gesture, acted out in a loop: a finger (or the pointer) pressing with a ripple where it lands,
 * or a hand (or the mouse) swaying side to side. Still for visitors who ask for less motion.
 */
const GestureMark = ({ gesture }: { gesture: HintGesture }) => {
  if (gesture === 'tap' || gesture === 'click')
    return (
      <span className={`${styles.gesture} ${styles.press}`} aria-hidden>
        {gesture === 'tap' ? (
          <Tap focusable="false" />
        ) : (
          <Cursor size={20} weight="regular" aria-hidden />
        )}
        <span className={`${styles.ripple} ${gesture === 'tap' ? styles.fingertip : styles.tip}`} />
      </span>
    )
  return (
    <span className={`${styles.gesture} ${styles.sway}`} aria-hidden>
      {gesture === 'drag-finger' ? (
        <SlideHorizontal focusable="false" />
      ) : (
        <MouseSimple size={20} weight="regular" aria-hidden />
      )}
    </span>
  )
}

// A ring a foot across, its line a finger wide, as seen 2.5 m away. Further off it grows with the
// distance, so it reads the same anywhere on the floor: a fixed size dwindles to a sub-pixel
// sliver a few meters out, where the floor is seen almost edge on.
const RING_INNER = 0.135
const RING_OUTER = 0.155
const SEEN_AT = 2.5
const MAX_GROWTH = 4

/** How much a ring at `ring` grows for an eye at `eye` to see it at its near size. */
const growth = (ring: Vector3, eye: Vector3) =>
  Math.min(MAX_GROWTH, Math.max(1, ring.distanceTo(eye) / SEEN_AT))
/** Just above the floor, so the ring is never lost in it. */
const LIFT = 0.006
// A touch over white, so after the room's tone mapping and exposure it still reads white on the
// oak, not grey (well under the bloom's threshold: it never glows).
const WHITE = new Color('#ffffff').multiplyScalar(1.4)

const TAP_OPACITY = 0.9
const HOVER_OPACITY = 0.55
const HINT_OPACITY = 0.85
/** One breath of the entry hint's ring (s). */
const HINT_PULSE_S = 1.8

const ringMaterial = () =>
  new MeshBasicMaterial({
    color: WHITE,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
  })

type FloorMarksProps = {
  marks: FloorMarksState
  hint: WalkHint | null
}

const FloorMarks = ({ marks, hint }: FloorMarksProps) => {
  const tapRing = useRef<Mesh>(null)
  const hoverRing = useRef<Mesh>(null)
  const hintRing = useRef<Mesh>(null)

  // Flat on the floor, facing up.
  const geometry = useMemo(
    () => new RingGeometry(RING_INNER, RING_OUTER, 96).rotateX(-Math.PI / 2),
    [],
  )
  const materials = useMemo(() => [ringMaterial(), ringMaterial(), ringMaterial()] as const, [])
  useEffect(
    () => () => {
      geometry.dispose()
      for (const material of materials) material.dispose()
    },
    [geometry, materials],
  )

  useFrame(({ camera, clock, invalidate }, delta) => {
    const now = clock.elapsedTime
    const eye = camera.position
    let busy = false

    // The walk's ring: grows a touch as it fades, gone before the walk ends.
    const tap = tapRing.current
    if (tap) {
      const t = marks.tap ? (now - marks.tap.at) / MARKER_FADE_S : 1
      if (marks.tap && t < 1) {
        tap.position.set(marks.tap.x, FLOOR_Y + LIFT, marks.tap.z)
        tap.scale.setScalar((0.85 + 0.35 * (1 - Math.pow(1 - t, 2))) * growth(tap.position, eye))
        materials[0].opacity = TAP_OPACITY * (1 - t)
        tap.visible = true
        busy = true
      } else {
        marks.tap = null
        tap.visible = false
      }
    }

    // The mouse's ring: follows the cursor softly, fades in and out.
    const hover = hoverRing.current
    if (hover) {
      const ease = 1 - Math.pow(0.6, Math.min(delta, 1 / 30) * 60)
      const target = marks.hover ? HOVER_OPACITY : 0
      if (marks.hover) {
        if (!hover.visible) hover.position.set(marks.hover.x, FLOOR_Y + LIFT, marks.hover.z)
        const dx = marks.hover.x - hover.position.x
        const dz = marks.hover.z - hover.position.z
        if (Math.abs(dx) + Math.abs(dz) > 0.002) {
          hover.position.x += dx * ease
          hover.position.z += dz * ease
          busy = true
        } else {
          hover.position.x = marks.hover.x
          hover.position.z = marks.hover.z
        }
      }
      hover.scale.setScalar(growth(hover.position, eye))
      const opacity = materials[1].opacity + (target - materials[1].opacity) * ease
      materials[1].opacity = Math.abs(opacity - target) < 0.005 ? target : opacity
      if (materials[1].opacity !== target) busy = true
      hover.visible = materials[1].opacity > 0.001
    }

    // The entry hint's ring: a slow breath, until the hint goes.
    const ring = hintRing.current
    if (ring) {
      ring.visible = !!hint
      if (hint) {
        const phase = (now % HINT_PULSE_S) / HINT_PULSE_S
        const breath = Math.sin(phase * Math.PI)
        ring.position.set(hint.x, FLOOR_Y + LIFT, hint.z)
        ring.scale.setScalar((1 + 0.3 * phase) * growth(ring.position, eye))
        materials[2].opacity = HINT_OPACITY * breath
        busy = true
      }
    }

    if (busy) invalidate()
  })

  return (
    <>
      {SHOW_FLOOR_RINGS && (
        <>
          <mesh
            ref={tapRing}
            geometry={geometry}
            material={materials[0]}
            visible={false}
            renderOrder={10}
          />
          <mesh
            ref={hoverRing}
            geometry={geometry}
            material={materials[1]}
            visible={false}
            renderOrder={10}
          />
        </>
      )}
      {/* The entry hint keeps its ring whatever the floor's (AR-177, owner, 2026-11-05). */}
      <mesh
        ref={hintRing}
        geometry={geometry}
        material={materials[2]}
        visible={false}
        renderOrder={10}
      />
      {hint && (
        <Html
          position={[hint.x, FLOOR_Y, hint.z]}
          center
          zIndexRange={[20, 0]}
          pointerEvents="none"
        >
          {/* Over its ring, so the ring stays clear. */}
          <div className={styles.hintAnchor}>
            <div className={`${styles.hint} ${hint.leaving ? styles.hintLeaving : ''}`}>
              {hint.lines.map(({ gesture, text }) => (
                <span key={text} className={styles.hintLine}>
                  <GestureMark gesture={gesture} />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </Html>
      )}
    </>
  )
}

export default FloorMarks
