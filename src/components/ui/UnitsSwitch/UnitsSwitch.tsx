'use client'

import { useRef, type KeyboardEvent } from 'react'

import c from 'classnames'

import { Button } from '@/components/ui/Button'
import type { Unit } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import styles from './UnitsSwitch.module.scss'

const UNITS: Unit[] = ['cm', 'in']
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

/**
 * The soft cm | in switch (docs/public-redesign/units.md, designs/units-switch.dc.html): one style
 * wherever it sits — after the artwork's size line, in the corner of the configurator's drawing,
 * at the end of the footer's legal row. A radio group: arrow keys move between the two cells,
 * Enter or Space chooses (the cells are buttons); Tab lands on the chosen one.
 */
export function UnitsSwitch({ className }: { className?: string }) {
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
      className={c(styles.track, className)}
      onKeyDown={moveFocus}
    >
      {UNITS.map((option) => (
        <Button
          key={option}
          variant="bare"
          role="radio"
          aria-checked={unit === option}
          tabIndex={unit === option ? 0 : -1}
          className={c(styles.cell, unit === option && styles.chosen)}
          onClick={() => setUnit(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  )
}
