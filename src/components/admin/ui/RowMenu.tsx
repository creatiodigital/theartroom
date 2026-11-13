'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { DotsThreeVertical } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './RowMenu.module.scss'

export type RowMenuItem = {
  id: string
  label: string
  /** One secondary line under the label, e.g. why an item is off. */
  hint?: string
  /** danger: red text, for Delete… and the like. */
  tone?: 'danger'
  /** Still listed and focusable, but does nothing (`aria-disabled`). */
  disabled?: boolean
  onSelect: () => void
}

export type RowMenuGroup = {
  /** A small caption over the group. Groups after the first sit under a divider. */
  label?: string
  /** A group with no items is left out. */
  items: RowMenuItem[]
}

type RowMenuProps = {
  /** The trigger's spoken name, e.g. "Actions for Elena Ruiz". */
  label: string
  groups: RowMenuGroup[]
  /** e.g. while the row's own action runs. A disabled trigger also closes the menu. */
  disabled?: boolean
  /** Minimum menu width in px (default: the drawn 190). */
  width?: number
}

/** Space between the trigger and the menu, and the closest the menu gets to the window edge. */
const GAP = 6
const EDGE = 8

/**
 * The ⋮ menu at the end of a list row (sales.md §2, questions.md Q6). A menu
 * button: arrows, Home and End move through the items, Escape closes and puts
 * focus back on the trigger, Tab and an outside click close it.
 *
 * The menu is `position: fixed` from the trigger's box, so a table that
 * scrolls sideways cannot clip it, and it opens upward when there is no room
 * below. It follows the trigger on scroll and resize. It
 * stays inside the row's DOM (no portal), so it belongs to the row for
 * assistive tech and tests alike.
 */
export function RowMenu({ label, groups, disabled = false, width = 190 }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  // A trigger that turns disabled closes the menu for good, rather than
  // bringing it back when the row is free again.
  if (open && disabled) setOpen(false)
  const shown = open && !disabled
  // Button takes no ref: the wrapper finds the trigger (its first button).
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // ArrowUp on the trigger opens the menu on its last item.
  const focusOnOpen = useRef<'first' | 'last'>('first')
  const groupId = useId()
  // A group whose items are all conditional may end up empty: no caption, no divider.
  const listed = groups.filter((group) => group.items.length > 0)

  const trigger = () => wrapRef.current?.querySelector('button') ?? null
  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
  const focusItem = (item: HTMLElement | undefined) => item?.focus({ preventScroll: true })

  // Under the trigger, right edges aligned, or above it when the room below is
  // short. Runs before the first paint and again whenever the page scrolls or
  // resizes, so the fixed menu follows its trigger instead of closing (a click
  // that first scrolls the item into view must still land on it).
  const place = useCallback(() => {
    const menu = menuRef.current
    const button = wrapRef.current?.querySelector('button')
    if (!menu || !button) return
    const box = button.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    const height = menu.offsetHeight
    const roomBelow = viewportHeight - box.bottom - GAP - EDGE
    const roomAbove = box.top - GAP - EDGE
    const upward = height > roomBelow && roomAbove > roomBelow
    const top = upward ? Math.max(EDGE, box.top - GAP - height) : box.bottom + GAP
    const left = Math.max(
      EDGE,
      Math.min(box.right - menu.offsetWidth, viewportWidth - EDGE - menu.offsetWidth),
    )
    menu.style.top = `${Math.round(top)}px`
    menu.style.left = `${Math.round(left)}px`
  }, [])

  // Place before it paints, then focus the first (or last) item.
  useLayoutEffect(() => {
    if (!shown || !menuRef.current) return
    place()
    menuRef.current.style.visibility = 'visible'
    const items = menuItems()
    focusItem(focusOnOpen.current === 'last' ? items[items.length - 1] : items[0])
  }, [shown, place])

  useEffect(() => {
    if (!shown) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    // Fixed positioning: follow the trigger when anything scrolls or resizes.
    const onMove = () => place()
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [shown, place])

  const closeToTrigger = () => {
    trigger()?.focus()
    setOpen(false)
  }

  const select = (item: RowMenuItem) => {
    if (item.disabled) return
    // Focus goes back to the trigger BEFORE the action runs: a dialog it opens
    // records the focused element to return to, and this item is unmounting.
    closeToTrigger()
    item.onSelect()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const inMenu = menuRef.current?.contains(event.target as Node) ?? false
    if (!inMenu) {
      // The trigger: Enter and Space click it; the arrows open the menu too.
      if (!shown && !disabled && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        focusOnOpen.current = event.key === 'ArrowUp' ? 'last' : 'first'
        setOpen(true)
      } else if (shown && event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
      return
    }
    const items = menuItems()
    const current = items.indexOf(document.activeElement as HTMLElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(items[current === -1 ? 0 : (current + 1) % items.length])
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(items[current <= 0 ? items.length - 1 : current - 1])
        break
      case 'Home':
        event.preventDefault()
        focusItem(items[0])
        break
      case 'End':
        event.preventDefault()
        focusItem(items[items.length - 1])
        break
      case 'Escape':
        event.preventDefault()
        closeToTrigger()
        break
      case 'Tab':
        // Not prevented: from the trigger, Tab carries on to the next control
        // (Shift+Tab to the previous one), as if the menu had never opened.
        closeToTrigger()
        break
    }
  }

  return (
    <div ref={wrapRef} className={styles.wrap} onKeyDown={onKeyDown}>
      <Button
        variant="bare"
        font="dashboard"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={shown}
        disabled={disabled}
        onClick={() => {
          focusOnOpen.current = 'first'
          setOpen((wasOpen) => !wasOpen)
        }}
      >
        <DotsThreeVertical size={16} weight="bold" aria-hidden />
      </Button>
      {shown && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={styles.menu}
          style={{ minWidth: width }}
        >
          {listed.map((group, index) => (
            <Fragment key={group.label ?? index}>
              {index > 0 && <div role="separator" className={styles.separator} />}
              <div
                role="group"
                aria-labelledby={group.label ? `${groupId}-${index}` : undefined}
                className={styles.group}
              >
                {group.label && (
                  <div id={`${groupId}-${index}`} className={styles.groupLabel}>
                    {group.label}
                  </div>
                )}
                {group.items.map((item) => (
                  <Button
                    key={item.id}
                    variant="bare"
                    font="dashboard"
                    role="menuitem"
                    tabIndex={-1}
                    aria-disabled={item.disabled || undefined}
                    className={c(
                      styles.item,
                      item.tone === 'danger' && styles.danger,
                      item.disabled && styles.itemDisabled,
                    )}
                    onClick={() => select(item)}
                  >
                    <span>{item.label}</span>
                    {item.hint && <span className={styles.hint}>{item.hint}</span>}
                  </Button>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
