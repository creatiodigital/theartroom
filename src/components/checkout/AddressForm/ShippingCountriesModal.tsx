'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import c from 'classnames'
import { CaretDown, Check, X } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getCountryName } from '@/lib/print-providers/dialCodes'

import styles from './ShippingCountriesModal.module.scss'

/** Countries whose row is not fully inside the list's visible part (the list is positioned). */
function countBelow(list: HTMLElement): number {
  const bottom = list.scrollTop + list.clientHeight + 1
  let below = 0
  for (const item of Array.from(list.children) as HTMLElement[]) {
    if (item.offsetTop + item.offsetHeight > bottom) below += 1
  }
  return below
}

type ShippingCountriesModalProps = {
  countryCodes: string[]
  /** The country already chosen in the form, marked in the list. */
  selectedCode?: string
  onClose: () => void
  /** Picking one here sets the form's country and closes — the buyer came
   *  looking for their country, so finding it should do something. */
  onSelect: (code: string) => void
}

/**
 * Where we currently ship, shown without leaving checkout (docs/public-redesign/order-flow.md
 * "Where we ship" window).
 *
 * A buyer who cannot find their country in the picker has exactly one question
 * — "do you ship to me?" — and the worst possible answer is making them leave a
 * half-filled checkout to go and look. So this is a window over the flow, every
 * field behind it untouched, and picking a country here sets it on the form.
 *
 * No search field (owner, 2026-11-13): the list is short enough to read whole.
 *
 * Nobody may miss a country: on desktop the window is wide enough (4 columns)
 * for the whole list at once. When it still does not fit (always on a phone),
 * the last row fades and a full-width bar says how many countries are below and
 * scrolls to them; it goes once the end is reached.
 */
export const ShippingCountriesModal = ({
  countryCodes,
  selectedCode,
  onClose,
  onSelect,
}: ShippingCountriesModalProps) => {
  const sorted = useMemo(
    () => [...countryCodes].sort((a, b) => getCountryName(a).localeCompare(getCountryName(b))),
    [countryCodes],
  )
  const listRef = useRef<HTMLUListElement>(null)
  const [below, setBelow] = useState(0)

  const measure = useCallback(() => {
    const list = listRef.current
    setBelow(list ? countBelow(list) : 0)
  }, [])

  // Re-measured when the list resizes (window, columns).
  useEffect(() => {
    const list = listRef.current
    measure()
    if (!list) return
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [measure])

  const scrollDown = () => {
    const list = listRef.current
    if (!list) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // One view, less a row, so the faded row is the first one read next.
    list.scrollBy({ top: list.clientHeight - 36, behavior: reduce ? 'auto' : 'smooth' })
  }

  // Arrow keys move between countries: left / right along a row, up / down a column.
  const moveFocus = (e: KeyboardEvent<HTMLUListElement>) => {
    const list = listRef.current
    if (!list) return
    const buttons = Array.from(list.querySelectorAll('button'))
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at === -1) return
    const columns = getComputedStyle(list).gridTemplateColumns.split(' ').length
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[
      e.key as 'ArrowRight' | 'ArrowLeft' | 'ArrowDown' | 'ArrowUp'
    ]
    if (step === undefined) return
    e.preventDefault()
    buttons[Math.min(buttons.length - 1, Math.max(0, at + step))]?.focus()
  }

  return (
    <Modal
      onClose={onClose}
      titleId="shipping-countries-title"
      maxWidth="760px"
      tone="public"
      layout="flush"
      phoneFullScreen
    >
      <div className={styles.window}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.eyebrow}>Delivery</span>
            <h2 id="shipping-countries-title" className={styles.title}>
              Where we ship
            </h2>
            <p className={styles.intro}>
              We deliver to {sorted.length} countries. Choose yours to continue.
            </p>
          </div>
          <Button variant="bare" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} weight="light" aria-hidden />
            <span className={styles.closeWord} aria-hidden>
              Close
            </span>
          </Button>
        </div>

        <div className={styles.body}>
          <div className={c(styles.listFrame, below > 0 && styles.moreBelow)}>
            <ul ref={listRef} className={styles.list} onScroll={measure} onKeyDown={moveFocus}>
              {sorted.map((code) => {
                const chosen = code === selectedCode
                return (
                  <li key={code}>
                    <Button
                      variant="bare"
                      className={c(styles.country, chosen && styles.countryChosen)}
                      aria-current={chosen ? 'true' : undefined}
                      onClick={() => onSelect(code)}
                    >
                      <span>{getCountryName(code)}</span>
                      {chosen && <Check size={16} weight="light" aria-hidden />}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </div>

          {below > 0 && (
            <Button variant="bare" className={styles.more} onClick={scrollDown}>
              <CaretDown size={16} weight="light" aria-hidden />
              <span>
                {below} more {below === 1 ? 'country' : 'countries'} below
              </span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
