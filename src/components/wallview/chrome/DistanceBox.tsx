'use client'

import type { ReactNode } from 'react'
import c from 'classnames'

import styles from './DistanceBox.module.scss'

type DistanceBoxProps = {
  /** The group's accessible name, e.g. "Distance to the wall edges". */
  label: string
  /** The word drawn on the item in the middle: "artwork", "group", "text". */
  itemLabel: string
  top: ReactNode
  right: ReactNode
  bottom: ReactNode
  left: ReactNode
}

/**
 * The wall view's box picture (wallview.md §3): a dashed box (the wall, or a text box's edge),
 * the item drawn in the middle, and a field on each side. Layout only: the caller's fields carry
 * their own names, values and handlers.
 */
export function DistanceBox({ label, itemLabel, top, right, bottom, left }: DistanceBoxProps) {
  return (
    <div role="group" aria-label={label} className={styles.box}>
      <span aria-hidden className={styles.item}>
        {itemLabel}
      </span>
      <span className={c(styles.slot, styles.top)}>{top}</span>
      <span className={c(styles.slot, styles.bottom)}>{bottom}</span>
      <span className={c(styles.slot, styles.left)}>{left}</span>
      <span className={c(styles.slot, styles.right)}>{right}</span>
    </div>
  )
}
