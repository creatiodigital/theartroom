'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowCounterClockwise, Pause, Play } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'

import { clock, PEEK_DURATION_S, PEEK_FULL } from './media'

import styles from './PeekPlayer.module.scss'

type PlayState = 'playing' | 'paused' | 'ended'

const TOGGLE = {
  playing: { label: 'Pause', Icon: Pause },
  paused: { label: 'Play', Icon: Play },
  ended: { label: 'Replay', Icon: ArrowCounterClockwise },
} as const

/**
 * Take a peek's window (docs/take-a-peek/README.md "The modal"): the full video, requested only now
 * and played once from the start, silent, with our own pause / play and a thin progress line (no
 * native controls); it stops on its last frame and offers a replay, never looping. Under it the
 * words and the page's button (`cta`, none on some pages). Closing the window removes the video.
 */
type PeekPlayerProps = {
  titleId: string
  /** The page's button under the words, or nothing. */
  cta: ReactNode
  /** The video reached its end (each time, a replay included). */
  onComplete: () => void
  /** The button was used. */
  onCta: () => void
}

export const PeekPlayer = ({ titleId, cta, onComplete, onCta }: PeekPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const [state, setState] = useState<PlayState>('playing')
  const [seconds, setSeconds] = useState(0)
  const [duration, setDuration] = useState(PEEK_DURATION_S)

  const showProgress = useCallback(() => {
    const video = videoRef.current
    if (!video || !fillRef.current) return
    const total = video.duration || PEEK_DURATION_S
    fillRef.current.style.transform = `scaleX(${Math.min(1, video.currentTime / total)})`
    setSeconds(Math.floor(video.currentTime))
  }, [])

  // Starts as the window opens; on close, stops the download too (a removed <video> may go on).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Strict Mode runs this twice in development, with the cleanup below in between.
    if (!video.getAttribute('src')) video.src = PEEK_FULL
    video.play().catch(() => setState('paused'))
    return () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  // The line follows every frame while playing: `timeupdate` comes only about four times a second.
  useEffect(() => {
    if (state !== 'playing') return
    let frame = requestAnimationFrame(function tick() {
      showProgress()
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [state, showProgress])

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (state === 'playing') {
      video.pause()
      return
    }
    if (state === 'ended') video.currentTime = 0
    video.play().catch(() => setState('paused'))
  }

  const { label, Icon } = TOGGLE[state]

  return (
    <div className={styles.player}>
      <div className={styles.media}>
        <video
          ref={videoRef}
          className={styles.video}
          src={PEEK_FULL}
          preload="none"
          muted
          playsInline
          aria-hidden
          onPlay={() => setState('playing')}
          onPause={(e) => setState(e.currentTarget.ended ? 'ended' : 'paused')}
          onEnded={() => {
            setState('ended')
            showProgress()
            onComplete()
          }}
          onTimeUpdate={showProgress}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || PEEK_DURATION_S)}
        />
        <div className={styles.controls}>
          <Button variant="bare" className={styles.toggle} onClick={toggle} aria-label={label}>
            <Icon
              size={16}
              weight="fill"
              aria-hidden
              className={state === 'paused' ? styles.playIcon : undefined}
            />
          </Button>
          <span className={styles.track}>
            <span ref={fillRef} className={styles.fill} />
          </span>
          <span className={styles.time}>
            {clock(seconds)} / {clock(duration)}
          </span>
        </div>
      </div>

      <div className={styles.words}>
        <div className={styles.text}>
          <span className={styles.label}>Take a peek</span>
          <h2 id={titleId} className={styles.title}>
            What arrives at your door
          </h2>
          {/* No certificate here: open editions have none (owner, 2026-11-26). */}
          <p className={styles.body}>
            Sent flat, wrapped in tissue and sealed. Archival fine-art paper, approved by the
            artist.
          </p>
        </div>
        {cta && (
          // Hears the button's click (a link or a button) without changing its layout.
          <div className={styles.ctaSlot} onClick={onCta}>
            {cta}
          </div>
        )}
      </div>
    </div>
  )
}
