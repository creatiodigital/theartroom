'use client'

import { useEffect, useRef, useState } from 'react'
import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import type { ArtworkMediaItem } from '@/lib/artwork/artworkMediaTypes'

import styles from './ObjectDetail.module.scss'

/** "0:24" */
const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`

function MotionItem({ item, name }: { item: ArtworkMediaItem; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [duration, setDuration] = useState<number | null>(null)

  // Plays, silent, while at least half of it is on screen; never on its own for a visitor who
  // asked for less motion (they start it with the sound button).
  useEffect(() => {
    const video = videoRef.current
    if (!video || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.5 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  const toggleSound = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
    if (video.paused) void video.play().catch(() => {})
  }

  const ratio = item.width && item.height ? `${item.width} / ${item.height}` : '9 / 16'
  const landscape = !!item.width && !!item.height && item.width > item.height

  return (
    <figure className={landscape ? styles.motionWide : styles.motionItem}>
      <span className={styles.motionBox} style={{ aspectRatio: ratio }}>
        <video
          ref={videoRef}
          // `#t=0.001`: the first frame shows before it plays (and when it never autoplays).
          src={`${item.url}#t=0.001`}
          className={styles.motionVideo}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={name}
          onClick={toggleSound}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
        <Button
          variant="bare"
          className={styles.sound}
          aria-label={muted ? `Turn the sound on: ${name}` : `Turn the sound off: ${name}`}
          aria-pressed={!muted}
          onClick={toggleSound}
        >
          {muted ? (
            <SpeakerSlash size={14} weight="fill" aria-hidden />
          ) : (
            <SpeakerHigh size={14} weight="fill" aria-hidden />
          )}
        </Button>
        {duration !== null && Number.isFinite(duration) && (
          <span className={styles.duration}>{formatDuration(duration)}</span>
        )}
      </span>
      {item.caption && <figcaption className={styles.figcaption}>{item.caption}</figcaption>}
    </figure>
  )
}

/**
 * "In motion" (docs/objects O5): an Object's reels and films. Reels (9:16) four across on desktop
 * and a sideways scroll of 150 px ones on phones; each plays without sound while in view, a tap
 * turns the sound on. Absent when there are none.
 */
export function ObjectInMotion({ videos, title }: { videos: ArtworkMediaItem[]; title: string }) {
  if (videos.length === 0) return null
  return (
    <section className={styles.mediaSection} aria-labelledby="object-in-motion">
      <div className={styles.mediaHead}>
        <h2 id="object-in-motion" className={styles.eyebrow}>
          In motion
        </h2>
        <span className={styles.mediaHint}>Plays without sound · tap for sound</span>
      </div>
      <div className={styles.motionRow}>
        {videos.map((item, i) => (
          <MotionItem key={item.id} item={item} name={item.caption || `${title}, film ${i + 1}`} />
        ))}
      </div>
    </section>
  )
}
