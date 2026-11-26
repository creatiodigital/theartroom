'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import c from 'classnames'
import Link from 'next/link'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { ProtectedImage } from '@/components/ui/ProtectedImage/ProtectedImage'
import { TakeAPeek } from '@/components/ui/TakeAPeek'
import type { HomePrintSlide } from '@/lib/queries/getGallerySelection'

import styles from './HomePrints.module.scss'

/** About 6 s per print (home.md §5). */
const ROTATE_MS = 6000

const workTitle = (slide: HomePrintSlide) => slide.title || slide.name

/** The work's page: its price, its editions and "Order a print". */
const artworkHref = (slide: HomePrintSlide) => `/artworks/${slide.slug}`

/** Each slide's margin, as a share of the stage's width (`.slide { margin: 6% }`). */
const SLIDE_MARGIN = 0.06

/** The print as shown, width over height: cropped to the piece where the render marks it. */
const shownAspect = ({ presentation: view }: HomePrintSlide) =>
  view.piece ? (view.aspect * view.piece.w) / view.piece.h : view.aspect

/**
 * The phone stage's shape, width over height (owner, 2026-11-14: less empty grey above and below
 * the print). The tallest print in the rotation fills the height inside the slide's margin, so a
 * list of landscape prints gets a shorter stage; never taller than the square every other screen
 * keeps, so a portrait print is no smaller than before.
 */
const phoneStageAspect = (slides: HomePrintSlide[]) => {
  const tallest = Math.min(...slides.map(shownAspect))
  return Math.max(1, 1 / ((1 - 2 * SLIDE_MARGIN) / tallest + 2 * SLIDE_MARGIN))
}

/**
 * The homepage's Fine-art prints (docs/public-redesign/home.md §5): on the render wall's grey, a
 * print presentation (as on the artwork page: the piece and a thin border of wall) beside the
 * section's words and "Discover the prints". No caption under the words (owner, 2026-11-26: the
 * work's title, artist, edition and price are gone in every view); the print itself opens its page,
 * and its link names the work and the artist.
 *
 * Rotates through Home page prints (admin › Content), in the list's order, about 6 s each, the
 * pictures cross-fading; no dots, no arrows. Holds still while the pointer or the keyboard is on
 * the section, and while the tab is hidden. With reduced motion it does not rotate: one print,
 * chosen at random per visit.
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
        <div
          className={styles.stage}
          style={{ '--phone-stage-aspect': phoneStageAspect(slides) } as CSSProperties}
        >
          {slides.map((slide, i) => {
            const title = workTitle(slide)
            return (
              <div
                key={slide.id}
                className={c(styles.slide, i === index && styles.current)}
                aria-hidden={i !== index}
              >
                {mounted.has(i) && slide.imageUrl && (
                  // The print opens its artwork page, where it can be ordered (owner, 2026-11-18).
                  // Only the slide on show takes clicks or focus: the others sit in the same cell.
                  <Link
                    href={artworkHref(slide)}
                    className={styles.slideLink}
                    tabIndex={i === index ? undefined : -1}
                    aria-label={`${title}, ${slide.artistName}`}
                  >
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
                  </Link>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.text}>
          <span className={styles.label}>Fine-art prints</span>
          <h2 id="home-prints-heading" className={styles.heading}>
            Every print, approved by the artist.
          </h2>
          {/* Only a limited edition comes with a certificate; an open edition comes with a
              personal letter from the gallery (owner, 2026-11-26). */}
          <p className={styles.lead}>
            Each one is produced on archival fine-art paper by the labs museums rely on and approved
            by the artist before it reaches your wall. A limited edition is also numbered on the
            print and comes with a certificate of authenticity carrying the artist&rsquo;s printed
            signature.
          </p>
          {/* What arrives at your door (docs/take-a-peek, P1): after the lead. */}
          <TakeAPeek size="full" placement="home" />
          <ArrowLink href="/prints" className={styles.link}>
            Discover the prints
          </ArrowLink>
        </div>
      </div>
    </section>
  )
}
