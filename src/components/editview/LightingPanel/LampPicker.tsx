'use client'

import { useRef, type KeyboardEvent } from 'react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import type { TLampGroup } from '@/types/scene'

import styles from './LampPicker.module.scss'

/** `groupNodesByRoom` names rooms "room0", "room1"…; the artist reads "Room 1", "Room 2"… */
export const roomNumberOf = (room: string) => Number(room.replace('room', '')) + 1

const MOVE_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']

type LampGridProps = {
  /** "Room 1 · 14 lamps" over a room's grid; none for a space without rooms. */
  caption: string | null
  label: string
  indices: number[]
  isOn: (index: number) => boolean
  selected: number
  onSelect: (index: number) => void
}

const LampGrid = ({ caption, label, indices, isOn, selected, onSelect }: LampGridProps) => {
  // Button takes no ref: the grid finds its own radios.
  const gridRef = useRef<HTMLDivElement>(null)
  const holdsSelected = indices.includes(selected)

  // The radio pattern: arrows and Home / End move to a lamp and pick it. Stopped here, so the
  // keys never also reach the window, where the room's camera walks on the arrows.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!MOVE_KEYS.includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const radios = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
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
    onSelect(indices[next])
    radios[next]?.focus()
  }

  return (
    <div className={styles.room}>
      {caption && <span className={styles.caption}>{caption}</span>}
      <div
        ref={gridRef}
        role="radiogroup"
        aria-label={label}
        className={styles.grid}
        onKeyDown={onKeyDown}
      >
        {indices.map((index, position) => {
          const on = isOn(index)
          const checked = index === selected
          // One stop per grid: the picked lamp, else the grid's first.
          const tabbable = holdsSelected ? checked : position === 0
          return (
            <Button
              key={index}
              variant="bare"
              font="dashboard"
              role="radio"
              aria-checked={checked}
              aria-label={`Lamp ${position + 1}, ${on ? 'on' : 'off'}`}
              tabIndex={tabbable ? 0 : -1}
              className={c(styles.lamp, !on && styles.off)}
              onClick={() => onSelect(index)}
            >
              {position + 1}
              <span className={c(styles.dot, on && styles.dotOn)} aria-hidden />
            </Button>
          )
        })}
      </div>
    </div>
  )
}

type LampPickerProps = {
  /** The space's track lamps as the scene grouped them (`state.scene.trackLampGroups`). */
  groups: TLampGroup[]
  isOn: (index: number) => boolean
  /** The picked lamp: the panel's own UI state, never dispatched or saved. */
  selected: number
  onSelect: (index: number) => void
}

/**
 * NEW (editor3d.md, approved): the track lamps as a grid of numbered buttons, a dot for on / off,
 * the picked one dark; the panel shows only the picked lamp's controls under it. A space with
 * rooms (Vienna) gets one grid per room under today's "Room n · k lamps" (questions.md Q133);
 * numbers restart per room, as the lamps' names always have.
 */
export const LampPicker = ({ groups, isOn, selected, onSelect }: LampPickerProps) => (
  <div className={styles.picker}>
    {groups.map((group) => {
      if (group.indices.length === 0) return null
      const room = group.room ? roomNumberOf(group.room) : null
      return (
        <LampGrid
          key={group.room ?? 'track-lamps'}
          caption={room === null ? null : `Room ${room} · ${group.indices.length} lamps`}
          label={room === null ? 'Lamps' : `Room ${room} lamps`}
          indices={group.indices}
          isOn={isOn}
          selected={selected}
          onSelect={onSelect}
        />
      )
    })}
  </div>
)
