'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './StageTabs.module.scss'

export type StageTab = {
  id: string
  label: string
  count: number
  /** Pipeline position, drawn as a numbered circle (hidden from screen readers). */
  step?: number
  /** Count color when it is above zero: red (always) or amber. Default: gray / dark. */
  countTone?: 'red' | 'amber'
}

type StageTabsProps = {
  /** Name of the whole tab row, e.g. "Order stages". */
  label: string
  /** Tab groups side by side; from the second on, each sits after a 1px divider. */
  groups: { label: string; tabs: StageTab[] }[]
  /** null = no tab selected (e.g. while a search spans every stage). */
  selected: string | null
  onSelect: (id: string) => void
}

/**
 * The stage tabs (orders.md §1). Arrow keys move along every tab of every
 * group; only one tab is in the Tab order (roving tabindex). Under 900px the
 * row scrolls sideways and keeps the selected tab in view.
 */
export function StageTabs({ label, groups, selected, onSelect }: StageTabsProps) {
  const navRef = useRef<HTMLElement>(null)
  const ids = groups.flatMap((g) => g.tabs.map((t) => t.id))
  const focusable = selected && ids.includes(selected) ? selected : ids[0]

  useEffect(() => {
    if (!selected) return
    const tab = navRef.current?.querySelector<HTMLElement>(`[data-tab-id="${selected}"]`)
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const tabs = Array.from(navRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])
    const current = tabs.indexOf(document.activeElement as HTMLElement)
    if (current === -1) return
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    tabs[next]?.focus()
    // The id sits on the wrapper: Button does not forward data- attributes.
    const id = tabs[next]?.closest<HTMLElement>('[data-tab-id]')?.dataset.tabId
    if (id) onSelect(id)
  }

  return (
    <nav ref={navRef} aria-label={label} className={styles.nav} onKeyDown={onKeyDown}>
      {groups.map((group, groupIndex) => (
        <div
          key={group.label}
          role="tablist"
          aria-label={group.label}
          className={c(styles.group, groupIndex > 0 && styles.groupAfter)}
        >
          {group.tabs.map((tab) => {
            const isSelected = tab.id === selected
            return (
              <span key={tab.id} data-tab-id={tab.id} className={styles.tabWrap}>
                <Button
                  variant="bare"
                  font="dashboard"
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={tab.id === focusable ? 0 : -1}
                  className={c(styles.tab, isSelected && styles.selected)}
                  onClick={() => onSelect(tab.id)}
                >
                  {tab.step !== undefined && (
                    <span aria-hidden className={styles.step}>
                      {tab.step}
                    </span>
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={c(
                      styles.count,
                      tab.count > 0 && styles.countSome,
                      tab.count > 0 && isSelected && styles.countSelected,
                      tab.count > 0 && tab.countTone && styles[`count_${tab.countTone}`],
                    )}
                  >
                    {tab.count}
                  </span>
                </Button>
              </span>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
