'use client'

import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

import { coverObjectPosition, coverSquare } from '@/lib/artwork/objectArtwork'

import styles from './ObjectCover.module.scss'

/** The cover preview's box: 4:5, the artwork page's shape (objects-editor.dc.html). */
export const COVER_BOX_RATIO = 4 / 5
const KEY_STEP = 0.02

type Crop = { x: number | null; y: number | null }
type Size = { width: number; height: number }

/**
 * The square crop on an Object's cover (docs/objects "Cover photo"): a dashed square over the
 * photo, the rest veiled. Grids, the library and lists show what is inside it. Drag it, or
 * focus it and use the arrow keys; it moves along the photo's long side only (it is the
 * largest square). Drawn inside the uploader's 4:5 preview, where the photo is contained.
 */
export function CoverCropFrame({
  size,
  crop,
  onChange,
}: {
  size: Size
  crop: Crop
  onChange: (next: { x: number; y: number }) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  const ratio = size.width / size.height
  // Where the contained photo sits in the box, as fractions of the box.
  const img =
    ratio > COVER_BOX_RATIO
      ? {
          left: 0,
          width: 1,
          height: COVER_BOX_RATIO / ratio,
          top: (1 - COVER_BOX_RATIO / ratio) / 2,
        }
      : {
          top: 0,
          height: 1,
          width: ratio / COVER_BOX_RATIO,
          left: (1 - ratio / COVER_BOX_RATIO) / 2,
        }
  const square = coverSquare(crop, size)
  const axis = square.sx < 1 ? 'x' : square.sy < 1 ? 'y' : null
  if (!axis) return null

  const move = (x: number, y: number) => {
    const next = coverSquare({ x, y }, size)
    onChange({ x: next.x, y: next.y })
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { px: event.clientX, py: event.clientY, x: square.x, y: square.y }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current
    const box = boxRef.current?.getBoundingClientRect()
    if (!start || !box) return
    move(
      start.x + (event.clientX - start.px) / (img.width * box.width),
      start.y + (event.clientY - start.py) / (img.height * box.height),
    )
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const along = axis === 'x' ? square.x : square.y
    const side = axis === 'x' ? square.sx : square.sy
    const step: Record<string, number> = {
      ArrowLeft: -KEY_STEP,
      ArrowUp: -KEY_STEP,
      ArrowRight: KEY_STEP,
      ArrowDown: KEY_STEP,
      Home: -1,
      End: 1,
    }
    if (!(event.key in step)) return
    event.preventDefault()
    const next =
      event.key === 'Home' ? side / 2 : event.key === 'End' ? 1 - side / 2 : along + step[event.key]
    if (axis === 'x') move(next, square.y)
    else move(square.x, next)
  }

  // The slider's value: how far the square sits along its free side, 0–100.
  const position = Number.parseFloat(
    coverObjectPosition({ x: square.x, y: square.y }, size).split(' ')[axis === 'x' ? 0 : 1],
  )
  const percent = (fraction: number) => `${fraction * 100}%`

  return (
    <div ref={boxRef} className={styles.overlay}>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Square crop for grids"
        aria-orientation={axis === 'x' ? 'horizontal' : 'vertical'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% from the ${axis === 'x' ? 'left' : 'top'}`}
        className={axis === 'x' ? styles.frameX : styles.frameY}
        style={{
          left: percent(img.left + (square.x - square.sx / 2) * img.width),
          top: percent(img.top + (square.y - square.sy / 2) * img.height),
          width: percent(square.sx * img.width),
          height: percent(square.sy * img.height),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

/**
 * "How it shows" (objects-editor.dc.html): the cover in a grid (its square crop), on the
 * artwork page (4:5, the whole photo) and in lists (its square crop, small).
 */
export function CoverPreviews({
  imageUrl,
  size,
  crop,
}: {
  imageUrl: string
  size: Size | null
  crop: Crop
}) {
  const position = coverObjectPosition(crop, size ?? {})
  return (
    <div className={styles.previews}>
      <span className={styles.previewsLabel}>How it shows</span>
      <div className={styles.previewRow}>
        <span className={styles.preview}>
          <img src={imageUrl} alt="" className={styles.grid} style={{ objectPosition: position }} />
          <span className={styles.previewCaption}>Grids · square</span>
        </span>
        <span className={styles.preview}>
          <img src={imageUrl} alt="" className={styles.page} />
          <span className={styles.previewCaption}>Artwork page · 4:5</span>
        </span>
        <span className={styles.preview}>
          <img src={imageUrl} alt="" className={styles.list} style={{ objectPosition: position }} />
          <span className={styles.previewCaption}>Lists</span>
        </span>
      </div>
    </div>
  )
}
