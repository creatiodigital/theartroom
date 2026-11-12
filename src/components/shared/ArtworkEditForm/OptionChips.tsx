'use client'

import { useId } from 'react'
import { Check } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './OptionChips.module.scss'

type OptionChipsProps = {
  /** The group's title, e.g. "Papers". */
  title: string
  options: { id: string; label: string; pressed: boolean }[]
  onToggle: (id: string) => void
}

/**
 * Printing restrictions / recommendations as toggle chips (artist.md §3): one
 * `aria-pressed` button per option, a check while pressed. The caller decides
 * what pressed means and what a toggle does (the groups' own handleToggle).
 */
export function OptionChips({ title, options, onToggle }: OptionChipsProps) {
  const titleId = useId()
  return (
    <div className={styles.group}>
      <h3 id={titleId} className={styles.title}>
        {title}
      </h3>
      <div role="group" aria-labelledby={titleId} className={styles.chips}>
        {options.map((option) => (
          <Button
            key={option.id}
            variant="bare"
            font="dashboard"
            className={c(styles.chip, option.pressed && styles.pressed)}
            aria-pressed={option.pressed}
            onClick={() => onToggle(option.id)}
          >
            {option.pressed && <Check size={14} weight="bold" aria-hidden />}
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
