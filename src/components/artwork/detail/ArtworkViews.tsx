'use client'

import c from 'classnames'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { PHOTO_VIEWS, type PresentationView } from '@/lib/printPresentation/record'

import styles from './ArtworkViews.module.scss'

/** What each of the four views shows, in its order: the framed view, then the three photos. */
const VIEW_NAMES = ['framed', 'unframed, its corner', 'a detail', 'a detail at its top edge']

/** "Hiver 2, the print: a detail" — a view's accessible name and its picture's alt text. */
export const viewAlt = (title: string, index: number) =>
  `${title}, the print: ${VIEW_NAMES[index]}`

/** The number of views when a work has its photos: the framed view and three photos. */
export const VIEW_COUNT = 1 + PHOTO_VIEWS.length

/**
 * A work's four views as small tiles (owner, 2026-11-20): the framed view first, then the photos
 * of the print — unframed at a corner, a detail, a detail at its top edge. Picking one shows it
 * large in the grey box. `grid`: two rows of two, below Inquire (tablets, desktop); `row`: one row
 * of four under the box (phones). Square corners (visitor-facing rule).
 */
export function ArtworkViews({
  presentation,
  imageUrl,
  title,
  selected,
  onSelect,
  layout,
  className,
}: {
  presentation: PresentationView & { photos: NonNullable<PresentationView['photos']> }
  imageUrl: string
  title: string
  selected: number
  onSelect: (index: number) => void
  layout: 'grid' | 'row'
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Views of the print"
      className={c(styles.views, layout === 'grid' ? styles.grid : styles.row, className)}
    >
      {([null, ...PHOTO_VIEWS] as const).map((kind, index) => (
        <Button
          key={kind ?? 'framed'}
          variant="bare"
          className={c(styles.tile, index === selected && styles.selected)}
          aria-pressed={index === selected}
          aria-label={viewAlt(title, index)}
          onClick={() => onSelect(index)}
        >
          {kind === null ? (
            <PrintPresentation
              view={presentation}
              size="small"
              crop
              className={styles.framed}
              renderClassName={styles.framedFit}
            >
              {(placement) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className={placement === 'window' ? undefined : styles.framedFit}
                  crossOrigin="anonymous"
                  decoding="async"
                  loading="lazy"
                />
              )}
            </PrintPresentation>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={presentation.photos[kind].small}
              alt=""
              className={styles.photo}
              decoding="async"
              loading="lazy"
            />
          )}
        </Button>
      ))}
    </div>
  )
}
