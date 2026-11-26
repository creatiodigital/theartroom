'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

import { PeekLoop } from './PeekLoop'
import { PeekPlayer } from './PeekPlayer'
import { clock, PEEK_DURATION_S } from './media'

import styles from './TakeAPeek.module.scss'

/** Where the circle sits: it picks the window's button. */
export type TakeAPeekPlacement =
  | 'home'
  | 'prints'
  | 'exhibition'
  | 'artist'
  | 'artwork'
  | 'room'
  | 'cart'

type TakeAPeekProps = {
  placement: TakeAPeekPlacement
  className?: string
} & (
  | {
      /** `full`: 96 px (84 on phones) with three lines: homepage, Prints page. */
      size: 'full' | 'inline'
      line?: never
    }
  | {
      /** `strip`: 56 px between hairlines, full width: exhibition and artist pages. */
      size: 'strip'
      /** The serif line beside the circle ("Works by … are also fine-art prints, approved by the artist."). */
      line: string
    }
)

const DURATION = clock(PEEK_DURATION_S)
const ARIA_LABEL = `Take a peek: watch what arrives at your door, ${PEEK_DURATION_S} seconds`

/** Pages where the window offers no button: the Prints page itself, and the cart (already buying). */
const NO_CTA: TakeAPeekPlacement[] = ['prints', 'cart']

/**
 * Take a peek (docs/take-a-peek/README.md): a small looping circle of a print being unboxed, with
 * its words, as one button that opens the full video in a window. One component, three sizes
 * (`full`, `strip`, `inline`); at most once per page.
 */
export const TakeAPeek = ({ size, placement, line, className }: TakeAPeekProps) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const titleId = useId()

  // Focus back on the circle once the window has gone. The Modal gives it back to whatever had it
  // when it opened, which Safari leaves on the page (a click does not focus a button there).
  useEffect(() => {
    if (open) wasOpen.current = true
    else if (wasOpen.current) triggerRef.current?.focus()
  }, [open])

  const cta = NO_CTA.includes(placement) ? null : (
    <Button href="/prints" variant="outlineInverse" size="regularSquared" className={styles.cta}>
      <ArrowRight size={16} weight="light" aria-hidden className={styles.ctaIcon} />
      Discover the prints
    </Button>
  )

  return (
    <>
      <Button
        ref={triggerRef}
        variant="bare"
        className={c(styles.trigger, styles[size], className)}
        onClick={() => setOpen(true)}
        aria-label={ARIA_LABEL}
        aria-haspopup="dialog"
      >
        <PeekLoop paused={open} />
        {size === 'full' && (
          <span className={styles.words}>
            <span className={styles.label}>Take a peek</span>
            <span className={styles.line}>What arrives at your door</span>
            <span className={styles.duration}>{DURATION}</span>
          </span>
        )}
        {size === 'strip' && (
          <>
            <span className={styles.words}>
              <span className={styles.stripLine}>{line}</span>
              <span className={styles.sub}>Take a peek at what arrives · {DURATION}</span>
            </span>
            <ArrowRight size={18} weight="light" aria-hidden className={styles.arrow} />
          </>
        )}
        {size === 'inline' && (
          <span className={styles.words}>
            <span className={styles.inlineLabel}>Take a peek</span>
            <span className={styles.sub}>What arrives at your door · {DURATION}</span>
          </span>
        )}
      </Button>
      {open &&
        // On the page's body: a parent with a transform (the room's pop-up) would trap a fixed window.
        createPortal(
          <Modal
            tone="public"
            surface="dark"
            showClose
            titleId={titleId}
            onClose={() => setOpen(false)}
          >
            <PeekPlayer titleId={titleId} cta={cta} />
          </Modal>,
          document.body,
        )}
    </>
  )
}
