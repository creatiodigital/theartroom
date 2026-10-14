'use client'

import { useEffect, useRef, useState } from 'react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'
import { getCountryName } from '@/lib/print-providers/dialCodes'

import styles from './AddressForm.module.scss'

const hasMoreBelow = (list: HTMLElement) =>
  list.scrollHeight - list.scrollTop - list.clientHeight > 1

type ShippingCountriesModalProps = {
  countryCodes: string[]
  onClose: () => void
  /** Picking one here sets the form's country and closes — the buyer came
   *  looking for their country, so finding it should do something. */
  onSelect: (code: string) => void
}

/**
 * Where we currently ship, shown without leaving checkout.
 *
 * A buyer who cannot find their country in the picker has exactly one question
 * — "do you ship to me?" — and the worst possible answer is making them leave a
 * half-filled checkout to go and look. So this is a modal over the flow, every
 * field behind it untouched.
 *
 * Selecting a country here sets it on the form. Someone who opened this list
 * was looking for their own country; finding it and then having to close the
 * dialog and hunt through the dropdown again is a needless second search.
 *
 * The list scrolls inside the dialog, and macOS hides scrollbars until you
 * scroll. The visible part ended on a full row and looked complete, so buyers
 * never saw the UK, the US or Spain below it. While countries remain below the
 * fold, the list fades at its edge and a line says so; both go once the end is
 * reached.
 */
export const ShippingCountriesModal = ({
  countryCodes,
  onClose,
  onSelect,
}: ShippingCountriesModalProps) => {
  const sorted = [...countryCodes].sort((a, b) =>
    getCountryName(a).localeCompare(getCountryName(b)),
  )

  const listRef = useRef<HTMLUListElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)

  // Re-measured on resize too: the grid drops from three columns to two on
  // phones, which changes how much of the list is below the fold.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => setMoreBelow(hasMoreBelow(list))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  return (
    <Modal onClose={onClose} titleId="shipping-countries-title" maxWidth="640px" showClose>
      <Text as="h2" font="serif" size="xl" id="shipping-countries-title">
        Where we ship
      </Text>
      <Text as="p" size="sm" className={styles.modalIntro}>
        We currently deliver to {sorted.length} countries. Choose yours to continue.
      </Text>

      <div className={c(styles.countryListFrame, { [styles.moreBelow]: moreBelow })}>
        <ul
          ref={listRef}
          className={styles.countryList}
          onScroll={(e) => setMoreBelow(hasMoreBelow(e.currentTarget))}
        >
          {sorted.map((code) => (
            <li key={code}>
              <Button
                variant="menuItem"
                size="smallSquared"
                fullWidth
                className={styles.countryItem}
                onClick={() => onSelect(code)}
                label={getCountryName(code)}
              />
            </li>
          ))}
        </ul>
      </div>

      <Text as="p" size="sm" className={c(styles.scrollHint, { [styles.moreBelow]: moreBelow })}>
        <Icon name="chevronDown" size={16} />
        Scroll to see all countries
      </Text>

      <Text as="p" size="sm" className={styles.modalOutro}>
        Not on the list yet? We’re adding new delivery countries as we grow — if yours matters to
        you, tell us and it moves up the list.
      </Text>
    </Modal>
  )
}
