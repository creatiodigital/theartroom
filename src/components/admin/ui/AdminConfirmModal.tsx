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
  /** An amber box under the message (e.g. "Artist payout already released"). */
  warning?: ReactNode
  confirmLabel: string
  /** The dismiss button's label, e.g. "Go back" or "Keep order". `null`: no dismiss button (e.g. a lone "Done"). */
  cancelLabel?: string | null
  /** Confirm is off without being busy, e.g. until "CONFIRM" is typed. */
  confirmDisabled?: boolean
  /** Shown on the confirm button while `busy`, e.g. "Pausing…". */
  busyLabel?: string
  destructive?: boolean
  busy?: boolean
  /** Defaults to Warning; e.g. Play for "Resume purchases?". `null`: no icon circle (a form). */
  icon?: Icon | null
  /**
   * wide: a form dialog, 760px. The title and buttons stay put and the body
   * scrolls between them; the warning sits under the body, so an error is never
   * scrolled out of sight.
   */
  size?: 'regular' | 'wide'
  onCancel: () => void
} & (
  | { form?: undefined; onConfirm: () => void }
  | {
      /**
       * The id of a <form> inside `message`: the confirm button becomes its
       * submit button (so Enter in a field submits too), and the form's own
       * onSubmit does the work instead of `onConfirm`.
       */
      form: string
      onConfirm?: undefined
    }
)

/**
 * The admin's confirmation dialog (dashboard-states.dc.html §4): icon circle,
 * title, message, Cancel + confirm. Rendered into the shell's dialog layer,
 * which keeps Tab inside it (Q5). The shared ConfirmModal keeps its own look
 * everywhere else.
 */
export function AdminConfirmModal({
  title,
  message,
  warning,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel = 'Working…',
  destructive = false,
  busy = false,
  icon: DialogIcon = Warning,
  size = 'regular',
  confirmDisabled = false,
  form,
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  const titleId = useId()
  const { layer, hold } = useAdminDialog()

  useLayoutEffect(() => hold(), [hold])

  if (!layer) return null

  const wide = size === 'wide'

  return createPortal(
    <Modal
      tone="admin"
      titleId={titleId}
      maxWidth={wide ? '760px' : undefined}
      onClose={busy ? () => {} : onCancel}
    >
      <div className={c(styles.dialog, wide && styles.wide)}>
        <div className={styles.head}>
          {DialogIcon && (
            <span
              aria-hidden
              className={c(styles.iconCircle, destructive ? styles.iconDanger : styles.iconNeutral)}
            >
              <DialogIcon size={20} weight="light" />
            </span>
          )}
          <div className={styles.text}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {!wide && <div className={styles.message}>{message}</div>}
            {!wide && warning && <div className={styles.warning}>{warning}</div>}
          </div>
        </div>
        {wide && <div className={styles.body}>{message}</div>}
        {wide && warning && <div className={styles.warning}>{warning}</div>}
        <div className={styles.actions}>
          {cancelLabel !== null && (
            <Button
              variant="secondary"
              font="dashboard"
              className={styles.button}
              label={cancelLabel}
              disabled={busy}
              onClick={onCancel}
            />
          )}
          <Button
            variant={destructive ? 'danger' : 'primary'}
            font="dashboard"
            className={c(styles.button, confirmDisabled && !busy && styles.off)}
            label={busy ? busyLabel : confirmLabel}
            disabled={busy || confirmDisabled}
            type={form ? 'submit' : 'button'}
            form={form}
            onClick={form ? undefined : onConfirm}
          />
        </div>
      </div>
    </Modal>,
    layer,
  )
}
