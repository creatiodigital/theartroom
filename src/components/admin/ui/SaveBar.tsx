'use client'

import { Check } from '@phosphor-icons/react'

import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './SaveBar.module.scss'

type SaveBarProps = {
  /** The form differs from its last loaded or saved values. */
  dirty: boolean
  saving: boolean
  /** The page's short "it saved" moment; shown as "Saved" only while nothing changed since. */
  saved?: boolean
  /** Omitted: no Discard button (artist.md: only where resetting is cheap). */
  onDiscard?: () => void
  /**
   * An always-enabled outline Cancel before Save, e.g. the artwork editor's way
   * back to the library (artist.md §3: "Cancel (today's behaviour)").
   */
  onCancel?: () => void
  /**
   * The content column the bar lines up with: 'form' 880px (default, the page
   * editor), 'list' the studio's 1080px column (the artwork editor).
   */
  width?: 'form' | 'list'
  /**
   * The last save was refused and nothing changed since (questions.md Q80): the status reads, in
   * red, "Not saved. Please try again." until the next accepted save or the next edit.
   */
  failed?: boolean
  /**
   * The red status text while `failed`, when a page knows more (e.g. the artwork editor's
   * "the new image was uploaded, the details were not"). Default "Not saved. Please try again."
   */
  failedMessage?: string
} & (
  | { onSave: () => void; form?: undefined }
  | {
      /**
       * The id of the <form> Save submits: Save becomes its submit button (so the
       * form's own onSubmit runs, and Enter in its fields submits), with no onClick.
       */
      form: string
      onSave?: undefined
    }
)

/**
 * The save bar fixed to the bottom of the content area (gallery.md §2c,
 * designs/content-editor.dc.html): the unsaved state on the left, Discard and
 * Save on the right. Save is never disabled here; the page decides what it does.
 */
export function SaveBar({
  dirty,
  saving,
  saved,
  onSave,
  onDiscard,
  onCancel,
  width = 'form',
  failed,
  failedMessage = 'Not saved. Please try again.',
  form,
}: SaveBarProps) {
  return (
    <div role="region" aria-label="Save" className={c(styles.bar, width === 'list' && styles.list)}>
      <div className={styles.inner}>
        {/* A refused save is an alert of its own, not a change of the polite status. */}
        {failed ? (
          <span role="alert" className={c(styles.status, styles.failed)}>
            {failedMessage}
          </span>
        ) : (
          <span role="status" className={styles.status}>
            {dirty ? (
              <span className={styles.unsaved}>
                <span className={styles.dot} aria-hidden />
                Unsaved changes
              </span>
            ) : (
              <span className={styles.clean}>All changes saved</span>
            )}
          </span>
        )}
        <div className={styles.actions}>
          {onDiscard && (
            <Button
              variant="bare"
              font="dashboard"
              className={styles.discard}
              onClick={onDiscard}
              disabled={!dirty || saving}
            >
              Discard
            </Button>
          )}
          {onCancel && (
            <Button variant="bare" font="dashboard" className={styles.discard} onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            variant="bare"
            font="dashboard"
            className={styles.save}
            type={form ? 'submit' : 'button'}
            form={form}
            onClick={form ? undefined : onSave}
          >
            {saving ? (
              'Saving…'
            ) : saved && !dirty ? (
              <>
                <Check size={16} weight="bold" aria-hidden />
                Saved
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
