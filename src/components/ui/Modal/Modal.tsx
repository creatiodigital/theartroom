'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import c from 'classnames'

import { useBackdropClose } from '@/hooks/useBackdropClose'

type ModalProps = {
  children: ReactNode
  onClose: () => void
  /**
   * ID of the element inside the modal that labels the dialog (usually
   * the modal's title heading). When provided it's forwarded to
   * `aria-labelledby` so screen readers announce the dialog by name on
   * open. Falls back to an unlabeled dialog if omitted.
   */
  titleId?: string
  /**
   * Optional override for the panel's max width (e.g. '640px'). Applied
   * inline so it wins over the default 560px without affecting other modals.
   */
  maxWidth?: string
  /**
   * Render a close button in the corner.
   *
   * Opt-in rather than default because four callers already draw their own, and
   * turning it on globally would give them two. Everything else closes only by
   * ESC or a backdrop click — neither of which exists or is discoverable on a
   * touch screen, so any modal a buyer meets on a phone should set this.
   */
  showClose?: boolean
  /**
   * `admin`: the admin redesign's dialog look (dark backdrop, 8px corners,
   * deeper shadow). `public`: the public site's windows (docs/public-redesign
   * order-flow.md: square, a deep shadow, a dim backdrop). Opt-in so every
   * other modal keeps its look.
   */
  tone?: 'default' | 'admin' | 'public'
  /**
   * `flush`: no padding and no scrolling of its own, for a window that lays out
   * its own header, scrolling middle and footer.
   */
  layout?: 'padded' | 'flush'
  /** Full screen on phones (below 640px): no inset, the panel fills the screen. */
  phoneFullScreen?: boolean
  /**
   * `dark`: no window; the content sits straight on a near-black backdrop, in white, with the ×
   * in the screen's corner, and fills the screen below 768px. For a video (Take a peek). The
   * content sizes itself.
   */
  surface?: 'panel' | 'dark'
}

import styles from './Modal.module.scss'

const Modal = ({
  children,
  onClose,
  titleId,
  maxWidth,
  showClose,
  tone = 'default',
  layout = 'padded',
  phoneFullScreen = false,
  surface = 'panel',
}: ModalProps) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const backdropClose = useBackdropClose(onClose)

  // ESC closes the modal — standard affordance every assistive-tech user
  // expects. Attached at document scope so it fires regardless of which
  // focused element is inside the modal.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // The page behind stays still while a window is open (owner, 2026-11-13). The values it had are
  // put back on close, so a window opened over another one (or over the phone menu, which locks
  // the same way) leaves theirs in place. The scrollbar's width goes on as padding so the page
  // does not shift sideways where scrollbars take room (Windows; macOS overlays take none).
  useEffect(() => {
    const { body, documentElement } = document
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
    const scrollbar = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    return () => {
      body.style.overflow = previous.overflow
      body.style.paddingRight = previous.paddingRight
    }
  }, [])

  // Move focus into the modal on mount so keyboard users aren't left
  // focused behind the backdrop, and restore focus to whatever was
  // active before the modal opened when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    contentRef.current?.focus()
    return () => {
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div
      className={c(
        styles.modal,
        tone === 'admin' && styles.admin,
        tone === 'public' && styles.public,
        phoneFullScreen && styles.phoneFullScreen,
        surface === 'dark' && styles.dark,
      )}
      onMouseDown={backdropClose.onMouseDown}
      onMouseUp={backdropClose.onMouseUp}
      data-no-deselect="true"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={c(styles.content, layout === 'flush' && styles.flush)}
        // Bounded by the viewport even when a caller names a width. As a bare
        // inline value this overrode the stylesheet's cap, so a modal asking for
        // 640px ran to both edges of a 390px phone.
        style={maxWidth ? { maxWidth: `min(${maxWidth}, 100%)` } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {showClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={20} weight="light" aria-hidden />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

export default Modal
