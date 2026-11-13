'use client'

import c from 'classnames'
import { useEffect, useRef, useState } from 'react'

import styles from './RoomLoader.module.scss'

type RoomLoaderProps = {
  /** 0..1, today's loading fraction. The line never goes backwards. */
  progress: number
  /** The room is ready (latched by the caller): the line completes, the screen fades out. */
  done: boolean
  title?: string
  artist?: string
}

const SLOW_MS = 20000
/** Never "done" early: the line stops here until the room is ready. */
const CAP = 0.96
const EASE = 0.06
const STALL_MS = 3000
const CREEP_PER_S = 0.002
const CREEP_MAX = 0.08
const FINISH_MS = 300
const FADE_MS = 500

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/**
 * The visitor's room loader (docs/public-redesign/room-loader.md, Option A2, type only): a still
 * title card on warm paper. Nothing moves but the red progress line, which follows the real progress
 * eased (never backwards), stops at 96 % until the room is ready, creeps a little while the progress
 * stalls so it never looks frozen, then completes and the screen fades out. The line runs in
 * requestAnimationFrame through `--d` (no render per frame). The bake page keeps MonogramLoader.
 */
export const RoomLoader = ({ progress, done, title, artist }: RoomLoaderProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const latched = useRef(0)
  latched.current = Math.max(latched.current, clamp01(progress))
  const target = useRef({ progress: latched.current, done })
  target.current = { progress: latched.current, done }

  const [phase, setPhase] = useState<'loading' | 'fading' | 'gone'>('loading')
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    // Reduced motion: the line still shows the progress, without easing.
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let d = 0
    let last = performance.now()
    let lastProgress = 0
    let lastMove = last
    let creep = 0
    let finish: { from: number; at: number } | null = null
    const timers: ReturnType<typeof setTimeout>[] = []

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { progress: p, done: ready } = target.current
      if (p > lastProgress) {
        lastProgress = p
        lastMove = now
      }
      if (ready && !finish) finish = { from: d, at: now }
      if (finish) {
        const t = instant ? 1 : Math.min(1, (now - finish.at) / FINISH_MS)
        d = finish.from + (1 - finish.from) * t
      } else {
        if (now - lastMove > STALL_MS) creep = Math.min(CREEP_MAX, creep + CREEP_PER_S * dt)
        const goal = Math.min(CAP, p + creep)
        d = instant ? Math.max(d, goal) : d + (goal - d) * EASE
      }
      root.style.setProperty('--d', d.toFixed(4))
      root.dataset.progress = d.toFixed(3)
      if (finish && d >= 1) {
        setPhase('fading')
        timers.push(setTimeout(() => setPhase('gone'), FADE_MS))
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      ref={rootRef}
      className={c(styles.loader, phase === 'fading' && styles.fading)}
      role="status"
      aria-live="polite"
      data-testid="monogram-loader"
      data-progress="0.000"
    >
      <span className="sr-only">{`Preparing the exhibition ${title ?? ''}`.trim()}</span>
      <div className={styles.card} aria-hidden="true">
        <span className={styles.eyebrow}>Now opening</span>
        {/* Their space is kept until they arrive, so nothing jumps; they fade in. */}
        <p className={c(styles.title, title && styles.shown)}>{title ?? ' '}</p>
        <span className={c(styles.artist, artist && styles.shown)}>{artist ?? ' '}</span>
        <span className={styles.track}>
          <span className={styles.line} />
        </span>
        <span className={styles.note}>Preparing the exhibition</span>
      </div>
      {/* Its space is there from the start, so the card never shifts; shown (and announced) at 20 s. */}
      <p className={c(styles.slow, slow && styles.slowShown)}>
        Large rooms take a little longer on slower connections.
      </p>
    </div>
  )
}
