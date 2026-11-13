'use client'

import { useEffect, useRef, useState } from 'react'
import c from 'classnames'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import type { HomePrintSlide } from '@/lib/queries/getGallerySelection'

import styles from './HomePrints.module.scss'

/** About 6 s per print (home.md §5). */
const ROTATE_MS = 6000

const workTitle = (slide: HomePrintSlide) => slide.title || slide.name

/**
 * The homepage's Fine-art prints (docs/public-redesign/home.md §5): on the render wall's grey, a
 * print presentation (as on the artwork page: the piece and a thin border of wall) beside the
 * section's words, the work's caption under a hairline, and "Discover the prints".
 *
 * Rotates through Home page prints (admin › Content), in the list's order, about 6 s each, the
 * picture and its caption cross-fading together; no dots, no arrows. Holds still while the pointer
 * or the keyboard is on the section, and while the tab is hidden. With reduced motion it does not
 * rotate: one print, chosen at random per visit.
 */
export const HomePrints = ({ slides }: { slides: HomePrintSlide[] }) => {
  const [index, setIndex] = useState(0)
  // Slides whose pictures are in the page: the current, the next (loading ahead) and every one
  // already shown (kept, so a cross-fade never waits on a picture).
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1]))
  const [still, setStill] = useState(false)
  const held = useRef(false)
  const count = slides.length

  useEffect(() => {
    if (count < 2) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reduce.matches) {
      const pick = Math.floor(Math.random() * count)
      setStill(true)
      setIndex(pick)
      setMounted(new Set([pick]))
      return
    }
    const timer = window.setInterval(() => {
      if (held.current || document.hidden) return
      setIndex((i) => {
        const next = (i + 1) % count
        setMounted((prev) => new Set(prev).add(next).add((next + 1) % count))
        return next
      })
    }, ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [count])

  if (count === 0) return null

  const hold = (on: boolean) => () => {
    held.current = on
  }

  return (
    <section
      className={c(styles.section, still && styles.still)}
      aria-labelledby="home-prints-heading"
      onPointerEnter={hold(true)}
      onPointerLeave={hold(false)}
      onFocus={hold(true)}
      onBlur={hold(false)}
    >
      <div className={styles.inner}>
        <div className={styles.stage}>
          {slides.map((slide, i) => {
            const title = workTitle(slide)
            return (
              <div
                key={slide.id}
                className={c(styles.slide, i === index && styles.current)}
                aria-hidden={i !== index}
              >
                {mounted.has(i) && slide.imageUrl && (
                  <PrintPresentation
                    view={slide.presentation}
                    size="large"
                    crop
                    renderClassName={styles.render}
                  >
                    {(placement) =>
                      placement === 'window' ? (
                        <ProtectedImage
                          src={slide.imageUrl!}
                          alt={`${title}, ${slide.artistName}, as a print`}
                          fill
                          sizes="(max-width: 768px) 90vw, 600px"
                        />
                      ) : (
                        <ProtectedImage
                          src={slide.imageUrl!}
                          alt={`${title}, ${slide.artistName}`}
                          width={slide.originalWidth ?? 1200}
                          height={slide.originalHeight ?? 900}
                          className={styles.plain}
                          sizes="(max-width: 768px) 90vw, 600px"
                        />
                      )
                    }
                  </PrintPresentation>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.text}>
          <span className={styles.label}>Fine-art prints</span>
          <h2 id="home-prints-heading" className={styles.heading}>
            Every print, approved and signed by the artist.
          </h2>
          <p className={styles.lead}>
            Each one is produced on archival fine-art paper by the labs museums rely on, approved by
            the artist before it reaches your wall, and arrives with a certificate of authenticity
            signed by the artist.
          </p>
          <div className={styles.captions}>
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                className={c(styles.caption, i === index && styles.current)}
                aria-hidden={i !== index}
              >
                <span className={styles.work}>
                  <i>{workTitle(slide)}</i>
                  {slide.year ? `, ${slide.year}` : ''}
                </span>
                <span className={styles.artist}>
                  {slide.artistName} · available as a signed print
                </span>
              </div>
            ))}
          </div>
          <ArrowLink href="/prints" className={styles.link}>
            Discover the prints
          </ArrowLink>
        </div>
      </div>
    </section>
  )
}
