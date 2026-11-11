'use client'

import { useId, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Warning, type Icon } from '@phosphor-icons/react'
import c from 'classnames'

import { useAdminDialog } from '@/components/admin/shell/AdminDialogContext'
import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'

import styles from './AdminConfirmModal.module.scss'

type AdminConfirmModalProps = {
  title: string
  message: ReactNode
  confirmLabel: string
  /** Shown on the confirm button while `busy`, e.g. "Pausing…". */
  busyLabel?: string
  destructive?: boolean
  busy?: boolean
  /** Defaults to Warning; e.g. Play for "Resume purchases?". */
  icon?: Icon
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The admin's confirmation dialog (dashboard-states.dc.html §4): icon circle,
 * title, message, Cancel + confirm. Rendered into the shell's dialog layer,
 * which keeps Tab inside it (Q5). The shared ConfirmModal keeps its own look
 * everywhere else.
 */
export function AdminConfirmModal({
  title,
  message,
  confirmLabel,
  busyLabel = 'Working…',
  destructive = false,
  busy = false,
  icon: DialogIcon = Warning,
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  const titleId = useId()
  const { layer, hold } = useAdminDialog()

  useLayoutEffect(() => hold(), [hold])

  if (!layer) return null

  return createPortal(
    <Modal tone="admin" titleId={titleId} onClose={busy ? () => {} : onCancel}>
      <div className={styles.dialog}>
        <div className={styles.head}>
          <span
            aria-hidden
            className={c(styles.iconCircle, destructive ? styles.iconDanger : styles.iconNeutral)}
          >
            <DialogIcon size={20} weight="light" />
          </span>
          <div className={styles.text}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <div className={styles.message}>{message}</div>
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            font="dashboard"
            className={styles.button}
            label="Cancel"
            disabled={busy}
            onClick={onCancel}
          />
          <Button
            variant={destructive ? 'danger' : 'primary'}
            font="dashboard"
            className={styles.button}
            label={busy ? busyLabel : confirmLabel}
            disabled={busy}
            onClick={onConfirm}
          />
        </div>
      </div>
    </Modal>,
    layer,
  )
}
