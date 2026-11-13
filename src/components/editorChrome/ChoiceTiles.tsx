'use client'

import { useRef, type CSSProperties, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/Button'

import styles from './ChoiceTiles.module.scss'

const MOVE_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']

type ChoiceTilesProps = {
  /** The group's accessible name, e.g. "Bench 2 model" (questions.md Q135). */
  label: string
  options: readonly { value: string; label: string }[]
  value: string
  /** Only with a value other than `value`, as a native select fires only on a change. */
  onChange: (value: string) => void
  /** Tiles per row: all of them in one row unless given. */
  columns?: number
}

/**
 * A short list as tiles, one picked (editor3d.md: a bench's Model, designs/editor-3d-panels.dc.html).
 * The radio pattern: one tab stop, the arrows and Home / End move to a tile and pick it. A long
 * name wraps to a second line rather than overflowing its tile.
 */
export function ChoiceTiles({
  label,
  options,
  value,
  onChange,
  columns = options.length,
}: ChoiceTilesProps) {
  // Button takes no ref: the group finds its own radios.
  const groupRef = useRef<HTMLDivElement>(null)
  const holdsValue = options.some((option) => option.value === value)

  const choose = (next: string) => {
    if (next !== value) onChange(next)
  }

  // Stopped here, so the keys never also reach the window, where the room's camera walks on the
  // arrows.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!MOVE_KEYS.includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const radios = Array.from(
      groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
    )
    const from = Math.max(0, radios.indexOf(document.activeElement as HTMLElement))
    const last = radios.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? from === last
              ? 0
              : from + 1
            : from === 0
              ? last
              : from - 1
    const option = options[next]
    if (option) choose(option.value)
    radios[next]?.focus()
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={styles.tiles}
      style={{ '--choice-columns': columns } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {options.map((option, position) => {
        const checked = option.value === value
        // One stop for the group: the picked tile, else the first.
        const tabbable = holdsValue ? checked : position === 0
        return (
          <Button
            key={option.value}
            variant="bare"
            font="dashboard"
            role="radio"
            aria-checked={checked}
            tabIndex={tabbable ? 0 : -1}
            className={styles.tile}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
