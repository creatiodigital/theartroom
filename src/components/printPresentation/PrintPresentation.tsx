'use client'

import c from 'classnames'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { PresentationWindow } from '@/lib/printPresentation/geometry'
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
 *
 * `crop` shows only the piece with a thin border of wall (`view.piece`), for a page that shows the
 * work as large as it can. An empty stand-in with that area's shape then sizes the piece (and takes
 * `renderClassName`), and the render behind it is scaled and shifted so only that area shows.
 */
export function PrintPresentation({
  view,
  size,
  crop = false,
  className,
  renderClassName,
  children,
}: {
  view: PresentationView | null | undefined
  size: PresentationSize
  /** Crop the shot to the piece and a thin border of wall. */
  crop?: boolean
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
  const height = Math.round(width / view.aspect)
  const area = crop ? view.piece : undefined
  if (area) {
    // A rect of the shot, placed in the cropped area (percentages of it).
    const place = (r: PresentationWindow) => ({
      left: pct((r.x - area.x) / area.w),
      top: pct((r.y - area.y) / area.h),
      width: pct(r.w / area.w),
      height: pct(r.h / area.h),
    })
    const areaW = Math.round(width * area.w)
    const areaH = Math.round(height * area.h)
    return (
      <div className={c(styles.presentation, styles.cropped, className)} data-print-presentation="">
        <div className={styles.window} style={place(view.window)} data-print-presentation-window="">
          {children('window')}
        </div>
        <img
          ref={render}
          className={styles.croppedRender}
          style={place({ x: 0, y: 0, w: 1, h: 1 })}
          src={view[size]}
          alt=""
          aria-hidden="true"
          decoding="async"
          onError={() => setFailed(true)}
        />
        <img
          className={c(styles.standIn, renderClassName)}
          src={`data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${areaW}" height="${areaH}"/>`,
          )}`}
          width={areaW}
          height={areaH}
          alt=""
          aria-hidden="true"
        />
      </div>
    )
  }
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
        height={height}
        alt=""
        aria-hidden="true"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
