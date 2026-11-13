'use client'

import { useRef, type KeyboardEvent } from 'react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './TabStrip.module.scss'

const MOVE_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End']

type TabStripProps<T extends string> = {
  /** The tab list's accessible name, e.g. "Item settings". */
  label: string
  tabs: readonly { id: T; label: string }[]
  selected: T
  onSelect: (id: T) => void
}

/**
 * The right panel's Layout / Look tabs (wallview.md §3). The tab pattern: one tab stop, the
 * arrows and Home / End move to a tab and select it. Those keys stop here, so they never also
 * reach the window, where the wall nudges the selected work on the arrows.
 */
export function TabStrip<T extends string>({ label, tabs, selected, onSelect }: TabStripProps<T>) {
  // Button takes no ref: the list finds its own tabs.
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!MOVE_KEYS.includes(event.key)) return
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])
    const current = buttons.indexOf(document.activeElement as HTMLElement)
    if (current === -1) return
    event.preventDefault()
    event.stopPropagation()
    const last = buttons.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
    const id = tabs[next]?.id
    if (id !== undefined) onSelect(id)
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={styles.tabs}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => {
        const isSelected = tab.id === selected
        return (
          <Button
            key={tab.id}
            variant="bare"
            font="dashboard"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={c(styles.tab, isSelected && styles.selected)}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </Button>
        )
      })}
    </div>
  )
}
