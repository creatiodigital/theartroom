'use client'

import { useEffect, useId, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { CaretDown } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import type { PageHeading } from '@/lib/richText/headingAnchors'

import styles from './ContentPage.module.scss'

/** A heading counts as the one being read once its top is this far down the window, or above. */
const READ_LINE_PX = 140

/**
 * "On this page" (docs/public-redesign/legal.md): the page's H2s, the one being read in dark with
 * its line; sticky beside the text on desktop, a field that opens the same list on phones. A click
 * scrolls to the section (smoothly, unless reduced motion is asked for) and moves focus to it.
 */
export function OnThisPage({ headings }: { headings: PageHeading[] }) {
  const [active, setActive] = useState(headings[0]?.id)
  const [open, setOpen] = useState(false)
  const listId = useId()

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current = headings[0]?.id
      for (const heading of headings) {
        const el = document.getElementById(heading.id)
        if (el && el.getBoundingClientRect().top <= READ_LINE_PX) current = heading.id
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [headings])

  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    event.preventDefault()
    // On phones the list is open above the text: closed first, so its height doesn't leave the
    // page while the scroll runs (it landed a section too far down).
    flushSync(() => setOpen(false))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    history.replaceState(null, '', `#${id}`)
    setActive(id)
  }

  const count = `${headings.length} sections`

  return (
    <nav aria-label="On this page" className={styles.onThisPage}>
      <span className={styles.label}>On this page</span>
      <Button
        variant="bare"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          On this page · <span className={styles.toggleCount}>{count}</span>
        </span>
        <CaretDown size={16} weight="light" aria-hidden className={c(open && styles.caretOpen)} />
      </Button>
      <ul id={listId} className={c(styles.list, open && styles.listOpen)}>
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className={c(styles.item, active === heading.id && styles.itemActive)}
              aria-current={active === heading.id ? 'location' : undefined}
              onClick={(event) => go(event, heading.id)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
