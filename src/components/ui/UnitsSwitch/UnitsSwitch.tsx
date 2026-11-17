'use client'

import { Fragment, useRef, type KeyboardEvent } from 'react'

import c from 'classnames'

import { Button } from '@/components/ui/Button'
import type { Unit } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import styles from './UnitsSwitch.module.scss'

const UNITS: Unit[] = ['cm', 'in']
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

/**
 * The cm | in choice (docs/public-redesign/units.md, designs/units-switch.dc.html). Two places, one
 * saved choice (`useUnits`, kept in this browser):
 * - `text` — the footer's own row, "Sizes in cm | in": plain words, the chosen one bold, a light
 *   divider; the other turns brand red on hover / focus (no underline).
 * - `track` — the print configurator's, in the drawing's corner (it has no footer): the soft track
 *   with a white chosen cell.
 * A radio group either way: arrow keys move between the two, Enter or Space chooses (they are
 * buttons); Tab lands on the chosen one.
 */
export function UnitsSwitch({
  look = 'track',
  className,
}: {
  look?: 'track' | 'text'
  className?: string
}) {
  const { unit, setUnit } = useUnits()
  const groupRef = useRef<HTMLDivElement>(null)

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!ARROWS.includes(event.key)) return
    event.preventDefault()
    const cells = Array.from(
      groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
    )
    const at = cells.findIndex((cell) => cell === document.activeElement)
    const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    cells[(at + step + cells.length) % cells.length]?.focus()
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Units"
      className={c(look === 'text' ? styles.text : styles.track, className)}
      onKeyDown={moveFocus}
    >
      {UNITS.map((option, index) => (
        <Fragment key={option}>
          {look === 'text' && index > 0 && (
            <span className={styles.divider} aria-hidden="true">
              |
            </span>
          )}
          <Button
            variant="bare"
            role="radio"
            aria-checked={unit === option}
            tabIndex={unit === option ? 0 : -1}
            className={c(styles.cell, unit === option && styles.chosen)}
            onClick={() => setUnit(option)}
          >
            {option}
          </Button>
        </Fragment>
      ))}
    </div>
  )
}
