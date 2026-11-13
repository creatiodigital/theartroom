'use client'

import type { Icon } from '@phosphor-icons/react'
import c from 'classnames'

import type { ToolTint } from './tints'

import styles from './IconTile.module.scss'

type IconTileProps = {
  icon: Icon
  /** 40: a panel's header; 32: a section's head. */
  size: 32 | 40
  /** A panel's tint, or a section head's white (closed) / dark (open). */
  tint: ToolTint | 'white' | 'dark'
}

/** The square icon tile of the editor's panels and sections (decorative: the title names it). */
export function IconTile({ icon: TileIcon, size, tint }: IconTileProps) {
  return (
    <span
      aria-hidden
      className={c(styles.tile, size === 40 ? styles.large : styles.small, styles[tint])}
    >
      <TileIcon size={size === 40 ? 22 : 18} weight="light" aria-hidden />
    </span>
  )
}
