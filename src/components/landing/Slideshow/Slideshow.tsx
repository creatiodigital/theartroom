'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import c from 'classnames'
import { Text } from '@/components/ui/Typography'
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
}

type SlideshowProps = {
  slides: Slide[]
  interval?: number
}

// 8s a slide (5s felt rushed, AR-174).
export const Slideshow = ({ slides, interval = 8000 }: SlideshowProps) => {
  const [activeIndex, setActiveIndex] = useState(0)

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
              through. (Its "Enter Virtual Exhibition" button was removed in AR-174: too invasive.) */}
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
              <Text as="p" size="sm" font="sans" className={styles.nowOpen}>
                Now open
              </Text>
              <Text as="h2" size="huge" font="serif" className={styles.title}>
                {slide.title}
              </Text>
              <Text as="p" size="xl" font="serif" className={styles.subtitle}>
                {slide.subtitle}
              </Text>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Slideshow
