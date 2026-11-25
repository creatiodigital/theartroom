'use client'

import { Fragment, useRef, type KeyboardEvent } from 'react'

import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { pageArea } from '@/lib/analytics/events'
import { track } from '@/lib/analytics/track'
import type { Unit } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import styles from './UnitsSwitch.module.scss'

const UNITS: Unit[] = ['cm', 'in']
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

/**
 * The cm | in choice (docs/public-redesign/units.md): a small squared toggle, the chosen unit filled
 * dark (owner, 2026-11-25: the plain words were "hard to notice even click on them"; "do a nice
 * squared toggle"). Every copy (the footer's, the artwork pages', the configurators' left panel)
 * sets one saved choice (`useUnits`, kept in this browser).
 * A radio group: arrow keys move between the two, Enter or Space chooses (they are buttons); Tab
 * lands on the chosen one.
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
      className={c(styles.switch, className)}
      onKeyDown={moveFocus}
    >
      {UNITS.map((option) => (
        <Fragment key={option}>
          <Button
            variant="bare"
            role="radio"
            aria-checked={unit === option}
            tabIndex={unit === option ? 0 : -1}
            className={c(styles.cell, unit === option && styles.chosen)}
            onClick={() => {
              if (option !== unit) {
                track('units_change', { unit: option, area: pageArea(window.location.pathname) })
              }
              setUnit(option)
            }}
          >
            {option}
          </Button>
        </Fragment>
      ))}
    </div>
  )
}
