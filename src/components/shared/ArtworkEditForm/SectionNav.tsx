'use client'

import { useEffect, useId, useState } from 'react'
import c from 'classnames'

import type { ArtworkSection } from './sections'

import styles from './SectionNav.module.scss'

/** A panel counts as reached once its top is this close to the viewport's top. */
const REACHED_PX = 120

/**
 * The artwork editor's "On this page" list (artist.md §3): a sticky column of
 * anchors to the panels that are rendered, the current one marked. Hidden
 * under 900px. The scroll spy (optional in the spec) marks the last panel whose
 * top has passed 120px, or the last one once the page is scrolled to its end.
 */
export function SectionNav({ sections }: { sections: readonly ArtworkSection[] }) {
  const captionId = useId()
  const [current, setCurrent] = useState<string | null>(null)
  const ids = sections.map((section) => section.id).join(' ')

  useEffect(() => {
    const list = ids.split(' ').filter(Boolean)
    if (list.length === 0) return
    let frame = 0
    const measure = () => {
      frame = 0
      const scrolledToEnd =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let next = list[0]
      if (scrolledToEnd) {
        next = list[list.length - 1]
      } else {
        for (const id of list) {
          const panel = document.getElementById(id)
          if (panel && panel.getBoundingClientRect().top <= REACHED_PX) next = id
        }
      }
      setCurrent(next)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids])

  return (
    <nav aria-labelledby={captionId} className={styles.nav}>
      <span id={captionId} className={styles.caption}>
        On this page
      </span>
      {sections.map((section) => {
        const isCurrent = section.id === current
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={isCurrent ? 'true' : undefined}
            className={c(styles.link, isCurrent && styles.current)}
            onClick={() => setCurrent(section.id)}
          >
            {section.title}
          </a>
        )
      })}
    </nav>
  )
}
