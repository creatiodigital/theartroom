'use client'

import {
  Image as ImageIcon,
  Shapes,
  SpeakerHigh,
  TextT,
  VideoCamera,
  type Icon,
} from '@phosphor-icons/react'
import c from 'classnames'

import styles from './ItemThumb.module.scss'

const TYPE_ICONS: Record<string, Icon> = {
  image: ImageIcon,
  text: TextT,
  shape: Shapes,
  video: VideoCamera,
  sound: SpeakerHigh,
}

type ItemThumbProps = {
  artworkType?: string
  imageUrl?: string | null
  /** row: "On this wall" (36×27); group: an autofocus group's stack (24×18). */
  size: 'row' | 'group'
}

/**
 * A wall item's thumbnail (wallview.md §1): the image itself for an image or a video that has one
 * (the list's rule before the redesign), else a grey tile with the type's icon. Decorative: the
 * item's name always sits beside it.
 */
export function ItemThumb({ artworkType, imageUrl, size }: ItemThumbProps) {
  if ((artworkType === 'image' || artworkType === 'video') && imageUrl) {
    return <img src={imageUrl} alt="" className={c(styles.thumb, styles[size])} />
  }

  const TypeIcon = TYPE_ICONS[artworkType ?? ''] ?? ImageIcon

  return (
    <span aria-hidden className={c(styles.thumb, styles.tile, styles[size])}>
      <TypeIcon size={size === 'group' ? 12 : 14} weight="light" aria-hidden />
    </span>
  )
}
