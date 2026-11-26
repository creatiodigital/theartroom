'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Play } from '@phosphor-icons/react'

import { PEEK_POSTER, PEEK_PREVIEW_MP4, PEEK_PREVIEW_WEBM } from './media'

import styles from './TakeAPeek.module.scss'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** True on the server, so the page arrives with the still and only a browser that allows motion adds the video. */
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  )

/**
 * The circle (docs/take-a-peek/README.md "The circle"): a seamless 3-second loop of the video,
 * silent, inside a ring, with a white play icon on top. It plays only while at least half of it is
 * on screen and the tab is visible, and holds while `paused` (the window is open). With reduced
 * motion there is no video, only its still.
 */
export const PeekLoop = ({ paused }: { paused: boolean }) => {
  const reduce = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let onScreen = false
    const sync = () => {
      if (onScreen && !paused && !document.hidden) {
        // Refused in some power-saving modes: the still frame stays, which is fine.
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.intersectionRatio >= 0.5
        sync()
      },
      { threshold: [0, 0.5] },
    )
    observer.observe(video)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [reduce, paused])

  return (
    <span className={styles.ring} aria-hidden>
      <span className={styles.window}>
        {/* The still, under the video until it has a frame of its own (and alone with reduced motion). */}
        <img src={PEEK_POSTER} alt="" className={styles.media} />
        {!reduce && (
          // No autoplay: the on-screen check above starts it, so a circle out of view never plays.
          <video
            ref={videoRef}
            className={styles.media}
            muted
            loop
            playsInline
            preload="metadata"
            poster={PEEK_POSTER}
          >
            <source src={PEEK_PREVIEW_WEBM} type="video/webm" />
            <source src={PEEK_PREVIEW_MP4} type="video/mp4" />
          </video>
        )}
      </span>
      <span className={styles.playLayer}>
        <Play weight="fill" className={styles.play} />
      </span>
    </span>
  )
}
