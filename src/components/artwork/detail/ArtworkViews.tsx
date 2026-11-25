'use client'

import type { ReactNode } from 'react'
import c from 'classnames'

import { PrintPresentation } from '@/components/printPresentation/PrintPresentation'
import { Button } from '@/components/ui/Button'
import { PHOTO_VIEWS, type PresentationView } from '@/lib/printPresentation/record'

import styles from './ArtworkViews.module.scss'

/** What each of the four views shows, in its order: the framed view, then the three photos. */
const VIEW_NAMES = ['framed', 'unframed, its corner', 'a detail', 'a detail at its top edge']

/** "Hiver 2, the print: a detail" — a view's accessible name and its picture's alt text. */
export const viewAlt = (title: string, index: number) => `${title}, the print: ${VIEW_NAMES[index]}`

/** The number of views when a work has its photos: the framed view and three photos. */
export const VIEW_COUNT = 1 + PHOTO_VIEWS.length

/** One tile: its accessible name and what it shows. */
export type ArtworkViewTile = {
  key: string
  label: string
  content: ReactNode
}

/**
 * A work's views as small tiles (owner, 2026-11-20); picking one shows it large in the grey box (no
 * mark on the picked tile, owner). An image work has four (the framed view, then the photos of the
 * print: `printViewTiles`); an Object two, its 3D model and its cover (docs/objects O5b). `grid`:
 * two to a row, below Inquire (tablets, desktop); `row`: four to a row under the box (phones), so
 * a tile keeps its size whatever the count. Square corners (visitor rule).
 */
export function ArtworkViews({
  tiles,
  label,
  selected,
  onSelect,
  layout,
  className,
}: {
  tiles: ArtworkViewTile[]
  /** The group's accessible name, e.g. "Views of the print". */
  label: string
  selected: number
  onSelect: (index: number) => void
  layout: 'grid' | 'row'
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={c(styles.views, layout === 'grid' ? styles.grid : styles.row, className)}
    >
      {tiles.map((tile, index) => (
        <Button
          key={tile.key}
          variant="bare"
          className={styles.tile}
          aria-pressed={index === selected}
          aria-label={tile.label}
          onClick={() => onSelect(index)}
        >
          {tile.content}
        </Button>
      ))}
    </div>
  )
}

/** A picture contained in its tile with a little grey round it: the framed view, an Object's cover. */
export const ViewTilePicture = ({ src }: { src: string }) => (
  <img src={src} alt="" className={styles.contained} decoding="async" loading="lazy" />
)

/** A tile that names its view, an icon over a word (an Object's "3D"). */
export const ViewTileWord = ({ icon, word }: { icon: ReactNode; word: string }) => (
  <span className={styles.word}>
    {icon}
    {word}
  </span>
)

/** An image work's four views: the framed view, then the photos of the print, each filling its tile. */
export function printViewTiles(
  presentation: PresentationView & { photos: NonNullable<PresentationView['photos']> },
  imageUrl: string,
  title: string,
): ArtworkViewTile[] {
  return ([null, ...PHOTO_VIEWS] as const).map((kind, index) => ({
    key: kind ?? 'framed',
    label: viewAlt(title, index),
    content:
      kind === null ? (
        <PrintPresentation
          view={presentation}
          size="small"
          crop
          className={styles.framed}
          renderClassName={styles.contained}
        >
          {(placement) => (
            <img
              src={imageUrl}
              alt=""
              className={placement === 'window' ? undefined : styles.contained}
              crossOrigin="anonymous"
              decoding="async"
              loading="lazy"
            />
          )}
        </PrintPresentation>
      ) : (
        <img
          src={presentation.photos[kind].small}
          alt=""
          className={styles.photo}
          decoding="async"
          loading="lazy"
        />
      ),
  }))
}
