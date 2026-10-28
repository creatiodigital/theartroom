'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  PRESENTATION_WIDTH_PX,
  type PresentationSize,
  type PresentationView,
} from '@/lib/printPresentation/record'

import styles from './PrintPresentation.module.scss'

/**
 * An artwork shown as a photo of the real print: the stored render (frame or sheet, wall,
 * shadows) with the ORIGINAL image, untouched, sitting in the render's transparent window.
 * `children` gives the surface's own image element for either placement: `'window'` (it fills the
 * window) or `'plain'` (exactly as the surface shows it without a presentation).
 *
 * The render is the in-flow element that sizes the piece: the surface styles it through
 * `renderClassName` the way it styled its bare image (same caps), and the piece shrink-wraps it.
 * Its width and height attributes come from the shot's shape, so the space is held before it
 * loads. It lets every pointer event through, so links, right-click protection and image errors
 * behave as before. If the render can't load, the plain image shows instead — never an empty card.
 */
export function PrintPresentation({
  view,
  size,
  className,
  renderClassName,
  children,
}: {
  view: PresentationView | null | undefined
  size: PresentationSize
  /** The piece (its placement). */
  className?: string
  /** The render (its size caps). */
  renderClassName?: string
  children: (placement: 'window' | 'plain') => ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const render = useRef<HTMLImageElement>(null)
  // A render that failed before the page came alive fired its error before anyone listened.
  useEffect(() => {
    const img = render.current
    if (img?.complete && img.naturalWidth === 0) setFailed(true)
  }, [view, size])

  if (!view || failed) return <>{children('plain')}</>
  const pct = (v: number) => `${v * 100}%`
  const width = PRESENTATION_WIDTH_PX[size]
  return (
    <div
      className={className ? `${styles.presentation} ${className}` : styles.presentation}
      data-print-presentation=""
    >
      <div
        className={styles.window}
        style={{
          left: pct(view.window.x),
          top: pct(view.window.y),
          width: pct(view.window.w),
          height: pct(view.window.h),
        }}
        data-print-presentation-window=""
      >
        {children('window')}
      </div>
      <img
        ref={render}
        className={renderClassName ? `${styles.render} ${renderClassName}` : styles.render}
        src={view[size]}
        width={width}
        height={Math.round(width / view.aspect)}
        alt=""
        aria-hidden="true"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
