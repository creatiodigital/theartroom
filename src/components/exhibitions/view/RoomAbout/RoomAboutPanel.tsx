'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowUpRight, X } from '@phosphor-icons/react'

import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'

import styles from './RoomAboutPanel.module.scss'

/** What the room's "About this exhibition" shows: the exhibition page's own data, read on the server. */
export type RoomAbout = {
  title: string
  artistName: string
  /** The full exhibition text, already rendered (sanitized on the server). */
  description: ReactNode | null
  /** `biography`: the bio's paragraphs, plain text (whole; owner 2026-11-12: never cut). */
  artist: { name: string; imageUrl: string | null; biography: string[] }
  exhibitionHref: string
  artistHref: string
}

/**
 * "About this exhibition" in the 3D room (docs/public-redesign/room-about.md,
 * designs/room-about-exhibition.dc.html): a panel on the left on desktop (the menu button on the
 * right stays free), a centered card on phones, framed as the "How to move around" window (owner,
 * 2026-11-13; it was a bottom sheet with a grab handle). The room stays visible and keeps rendering; clicks,
 * the wheel and keys inside the panel never reach it (`data-panel-overlay`, keys stopped). Esc, ×
 * and a click or tap outside it close it, as the "How to move around" window does (owner,
 * 2026-11-14): outside is a clear backdrop over the room, under the menu button, so the room stays
 * visible and the button stays in reach, and that click only closes, it never walks. It takes the
 * focus when it opens. No change to the scene.
 */
export const RoomAboutPanel = ({ about, onClose }: { about: RoomAbout; onClose: () => void }) => {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      {/* Outside the panel: a click or tap there closes it, and never reaches the room. */}
      <div className={styles.backdrop} onClick={onClose} data-panel-overlay aria-hidden />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-labelledby="room-about-title"
        tabIndex={-1}
        data-panel-overlay
        // Keys typed here (Tab, arrows, space) are the panel's, never the room's walking keys.
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <span id="room-about-title" className={styles.eyebrow}>
            About this exhibition
          </span>
          <Button variant="bare" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} weight="light" aria-hidden />
          </Button>
        </div>

        <div className={styles.body}>
          <span className={styles.artistCaps}>{about.artistName}</span>
          <h2 className={styles.title}>{about.title}</h2>

          {about.description && <div className={styles.text}>{about.description}</div>}

          <section className={styles.artist} aria-labelledby="room-about-artist">
            <h3 id="room-about-artist" className={styles.label}>
              About the artist
            </h3>
            <div className={styles.artistRow}>
              {about.artist.imageUrl ? (
                // A small portrait in the room's panel: the plain CDN image, no optimizer round trip.
                <img src={about.artist.imageUrl} alt="" className={styles.portrait} />
              ) : (
                <span className={styles.portrait} aria-hidden />
              )}
              <div className={styles.artistText}>
                <span className={styles.artistName}>{about.artist.name}</span>
                {about.artist.biography.map((paragraph, index) => (
                  <p key={index} className={styles.bio}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <div className={styles.links}>
            <ArrowLink href={about.exhibitionHref} newTab size="small">
              Exhibition page <ArrowUpRight size={13} weight="light" aria-hidden />
            </ArrowLink>
            <ArrowLink href={about.artistHref} newTab size="small">
              View artist <ArrowUpRight size={13} weight="light" aria-hidden />
            </ArrowLink>
          </div>
          <p className={styles.note}>Both open in a new tab, so you keep your place in the room.</p>
        </div>
      </div>
    </>
  )
}
