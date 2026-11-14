'use client'

import { useId } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

import styles from './ConfirmModal.module.scss'

type ConfirmModalProps = {
  title: string
  /** The explanation shown in the body. Can be a string or richer JSX. */
  message: ReactNode
  /** Extra warning banner rendered above the buttons (e.g. "Artist already paid"). */
  warning?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Show the confirm button as destructive (red-ish treatment). */
  destructive?: boolean
  /** Hide the confirm button while the action is running so it can't fire twice. */
  busy?: boolean
  /** Drop the confirm button entirely, leaving only the dismiss control. For a
   *  modal that has become a REFUSAL — the action was attempted and the server
   *  said no — so the only honest thing left to offer is "Close". */
  hideConfirm?: boolean
  /** 'wide' fits form-sized content: broader panel, message area scrolls
   *  internally (title + actions stay pinned). Default fits short confirms. */
  size?: 'regular' | 'wide'
  /** 'public' on the client side (the cart, the print wizard): a square window and square
   *  buttons, as every client control (owner, 2026-11-14). The dashboard keeps the default. */
  tone?: 'default' | 'public'
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal = ({
  title,
  message,
  warning,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  hideConfirm = false,
  size = 'regular',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const titleId = useId()
  const wide = size === 'wide'
  const buttonSize = tone === 'public' ? 'regularSquared' : undefined

  return (
    <Modal
      onClose={busy ? () => {} : onCancel}
      titleId={titleId}
      maxWidth={wide ? 'min(760px, 90vw)' : undefined}
      tone={tone}
    >
      <div className={wide ? styles.bodyWide : styles.body}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={wide ? `${styles.message} ${styles.messageScroll}` : styles.message}>
          {message}
        </div>
        {warning && <div className={styles.warning}>{warning}</div>}
        <div className={styles.actions}>
          <Button
            font="dashboard"
            variant="secondary"
            size={buttonSize}
            label={cancelLabel}
            onClick={onCancel}
            disabled={busy}
          />
          {!hideConfirm && (
            <Button
              font="dashboard"
              size={buttonSize}
              variant={destructive ? 'danger' : 'primary'}
              label={busy ? 'Working…' : confirmLabel}
              onClick={onConfirm}
              disabled={busy}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
