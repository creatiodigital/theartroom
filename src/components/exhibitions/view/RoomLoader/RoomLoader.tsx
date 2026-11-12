'use client'

import c from 'classnames'
import { useEffect, useRef, useState } from 'react'

import { MARK_PATHS } from '@/components/ui/MonogramLoader'

import styles from './RoomLoader.module.scss'

type RoomLoaderProps = {
  /** 0..1, today's loading fraction. The displayed value never goes backwards. */
  progress: number
  /** The room is ready (latched by the caller): finish, hold, fade out, unmount. */
  done: boolean
  title?: string
  artist?: string
  /** The exhibition's cover (thumbnailUrl). */
  imageUrl?: string
}

const CAPTIONS = ['Hanging the works', 'Setting the lights', 'Opening the doors']
const CAPTION_MS = 8000
const SLOW_MS = 20000
/** Never "done" early: the print stays a touch soft until the room is ready. */
const CAP = 0.96
const EASE = 0.06
const STALL_MS = 3000
const CREEP_PER_S = 0.002
const CREEP_MAX = 0.08
const FINISH_MS = 400
const HOLD_MS = 300
const FADE_MS = 500
const FAST_MS = 1500

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)

/**
 * The visitor's room loader, "Developing" (docs/public-redesign/room-loader.md, Option A): the
 * exhibition's cover rises out of blank paper like a photograph in a darkroom tray, driven by the real
 * loading progress. The value is eased every frame and written to `--d` on the wrapper (no React
 * render per frame); the styles read it. It never finishes before `done`, and never stands still on a
 * slow connection. The bake page keeps MonogramLoader.
 */
export const RoomLoader = ({ progress, done, title, artist, imageUrl }: RoomLoaderProps) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const latched = useRef(0)
  latched.current = Math.max(latched.current, clamp01(progress))
  const target = useRef({ progress: latched.current, done })
  target.current = { progress: latched.current, done }

  const [phase, setPhase] = useState<'loading' | 'fading' | 'gone'>('loading')
  const [caption, setCaption] = useState(0)
  const [slow, setSlow] = useState(false)
  // The cover arrives with the exhibition's data, often after the first frame. It starts developing
  // once decoded; until then (or without one) the paper is blank.
  const [decoded, setDecoded] = useState<{ url: string; ok: boolean } | null>(null)
  const cover = !imageUrl
    ? 'none'
    : decoded?.url === imageUrl
      ? decoded.ok
        ? 'ready'
        : 'failed'
      : 'decoding'
  useEffect(() => {
    if (!imageUrl) return
    let live = true
    const img = new Image()
    img.src = imageUrl
    img
      .decode()
      .then(() => live && setDecoded({ url: imageUrl, ok: true }))
      .catch(() => live && setDecoded({ url: imageUrl, ok: false }))
    return () => {
      live = false
    }
  }, [imageUrl])

  useEffect(() => {
    const cycle = setInterval(() => setCaption((i) => (i + 1) % CAPTIONS.length), CAPTION_MS)
    const slowLine = setTimeout(() => setSlow(true), SLOW_MS)
    return () => {
      clearInterval(cycle)
      clearTimeout(slowLine)
    }
  }, [])

  // The developing value, every frame: eased toward the progress (capped), creeping a little while
  // the progress stalls, then finished to 1 once the room is ready.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const startedAt = performance.now()
    let frame = 0
    let d = 0
    let last = startedAt
    let lastProgress = 0
    let lastMove = startedAt
    let creep = 0
    let finish: { from: number; at: number; fast: boolean } | null = null
    const timers: ReturnType<typeof setTimeout>[] = []

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { progress: p, done: ready } = target.current
      if (p > lastProgress) {
        lastProgress = p
        lastMove = now
      }
      if (ready && !finish) finish = { from: d, at: now, fast: now - startedAt < FAST_MS }
      if (finish) {
        const t = Math.min(1, (now - finish.at) / FINISH_MS)
        d = finish.from + (1 - finish.from) * t
      } else {
        if (now - lastMove > STALL_MS) creep = Math.min(CREEP_MAX, creep + CREEP_PER_S * dt)
        const goal = Math.min(CAP, p + creep)
        d += (goal - d) * EASE
      }
      root.style.setProperty('--d', d.toFixed(4))
      root.dataset.progress = d.toFixed(3)
      if (finish && now - finish.at >= FINISH_MS) {
        // Hold the finished print a moment (not on a fast connection), then fade the screen out.
        const hold = finish.fast ? 0 : HOLD_MS
        timers.push(setTimeout(() => setPhase('fading'), hold))
        timers.push(setTimeout(() => setPhase('gone'), hold + FADE_MS))
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

  const showCover = cover === 'ready' || cover === 'decoding'
  return (
    <div
      ref={rootRef}
      className={c(styles.loader, phase === 'fading' && styles.fading)}
      role="status"
      aria-live="polite"
      data-testid="monogram-loader"
      data-progress="0.000"
    >
      <div className={styles.paper}>
        {showCover ? (
          // Decorative: the title below says what it is. Hidden until decoded (blank paper).
          <img
            src={imageUrl}
            alt=""
            className={c(styles.print, cover === 'ready' && styles.printReady)}
            decoding="async"
          />
        ) : (
          // No cover, or it failed: the red monogram fills with the progress, as before.
          <div className={styles.mark} aria-hidden="true">
            <svg className={styles.layer} viewBox="0 0 850.39 907.09">
              {MARK_PATHS.map((path) => (
                <path key={path} d={path} className={styles.grey} />
              ))}
            </svg>
            <div className={c(styles.layer, styles.redLayer)}>
              <svg className={styles.layer} viewBox="0 0 850.39 907.09">
                {MARK_PATHS.map((path) => (
                  <path key={path} d={path} className={styles.red} />
                ))}
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className={styles.text}>
        <span className={styles.eyebrow}>Now opening</span>
        {title && <p className={styles.title}>{title}</p>}
        {artist && <span className={styles.artist}>{artist}</span>}
      </div>

      <div className={styles.line} aria-hidden="true">
        <span className={styles.lineFill} />
      </div>

      <div className={styles.captions}>
        <span key={caption} className={styles.caption}>
          {CAPTIONS[caption]}
        </span>
        {slow && (
          <span className={styles.slow}>
            Large rooms take a little longer on slower connections.
          </span>
        )}
      </div>
    </div>
  )
}
