'use client'

import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './SegmentedControl.module.scss'

type SegmentedControlProps<T extends string> = {
  /** The group's spoken name, e.g. "Kind". */
  label: string
  options: { id: T; label: string }[]
  /** The pressed option's id. */
  value: T
  onChange: (id: T) => void
}

/**
 * One choice out of a few, as joined buttons (sales.md §2, the Kind filter):
 * a labelled group of toggle buttons, the chosen one pressed. 34px, 44px under
 * 900px, where the options share the full row and may wrap their words.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {options.map((option) => {
        const pressed = option.id === value
        return (
          <Button
            key={option.id}
            variant="bare"
            font="dashboard"
            aria-pressed={pressed}
            className={c(styles.option, pressed && styles.pressed)}
            label={option.label}
            onClick={() => onChange(option.id)}
          />
        )
      })}
    </div>
  )
}
