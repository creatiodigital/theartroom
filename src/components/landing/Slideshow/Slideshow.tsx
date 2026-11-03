'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import c from 'classnames'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { useCanEnterWalkthrough } from '@/hooks/useCanEnterWalkthrough'
import { reportImageError } from '@/lib/observability/reportImageError'

import styles from './Slideshow.module.scss'

// Below the `lg` breakpoint (1024px, where the desktop layout starts) a slide
// shows its portrait image if it has one. Keep in sync with `bp(lg)` in mixins.
const MOBILE_IMAGE_MEDIA = '(max-width: 1023.98px)'

type Slide = {
  id: string
  imageUrl: string
  mobileImageUrl?: string | null
  exhibitionUrl: string
  subtitle: string
  title: string
  meta: string
  textColor?: string
  /** Straight into the exhibition's 3D space, when it's published; null for none. */
  visitUrl?: string | null
  ctaBackgroundColor?: string
  ctaTextColor?: string
}

type SlideshowProps = {
  slides: Slide[]
  interval?: number
}

export const Slideshow = ({ slides, interval = 5000 }: SlideshowProps) => {
  const [activeIndex, setActiveIndex] = useState(0)
  // The 3D walk-through is for laptops and desktops (as on the exhibition page): CSS hides the
  // button elsewhere from the first paint, this settles the iPad with a trackpad after hydration.
  const canEnter = useCanEnterWalkthrough()

  useEffect(() => {
    if (slides.length <= 1) return
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length)
    }, interval)
    return () => window.clearInterval(id)
  }, [slides.length, interval])

  return (
    <div className={styles.slideshow}>
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          className={c(styles.slide, index === activeIndex && styles.slideActive)}
        >
          {/* The whole slide opens the exhibition page. The text lies over it and lets clicks
              through; the Enter button is a link of its own on top, never inside this one. */}
          <Link
            href={slide.exhibitionUrl}
            className={styles.slideLink}
            aria-label={[slide.title, slide.subtitle].filter(Boolean).join(': ')}
          >
            {/* <picture> so the browser downloads ONLY the image its screen uses. */}
            <picture>
              {slide.mobileImageUrl && (
                <source media={MOBILE_IMAGE_MEDIA} srcSet={slide.mobileImageUrl} />
              )}
              <img
                src={slide.imageUrl}
                alt=""
                className={styles.background}
                loading={index === 0 ? 'eager' : 'lazy'}
                onError={(e) =>
                  reportImageError(e.currentTarget.currentSrc || slide.imageUrl, {
                    surface: 'home-slideshow',
                  })
                }
              />
            </picture>
          </Link>
          <div className={styles.container}>
            <div className={styles.content} style={{ color: slide.textColor || '#ffffff' }}>
              {slide.meta && (
                <Text as="p" size="sm" className={styles.meta}>
                  {slide.meta}
                </Text>
              )}
              <Text as="h2" size="huge" font="serif" className={styles.title}>
                {slide.title}
              </Text>
              <Text as="p" size="xl" font="serif" className={styles.subtitle}>
                {slide.subtitle}
              </Text>
              {slide.visitUrl && canEnter && (
                <div className={styles.cta}>
                  <Button
                    variant="primary"
                    size="bigSquared"
                    label="Enter 3D room"
                    href={slide.visitUrl}
                    icon="arrowRight"
                    className={styles.ctaButton}
                    style={{
                      backgroundColor: slide.ctaBackgroundColor,
                      borderColor: slide.ctaBackgroundColor,
                      color: slide.ctaTextColor,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Slideshow
