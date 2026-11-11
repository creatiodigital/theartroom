'use client'

import type { ReactNode } from 'react'
import { Check } from '@phosphor-icons/react'

import { Button } from '@/components/ui/Button'

import styles from './SaveBar.module.scss'

type SaveBarProps = {
  /** The form differs from its last loaded or saved values. */
  dirty: boolean
  saving: boolean
  /** The page's short "it saved" moment; shown as "Saved" only while nothing changed since. */
  saved?: boolean
  onSave: () => void
  /** Omitted: no Discard button (artist.md: only where resetting is cheap). */
  onDiscard?: () => void
  /** Replaces the status with red `role="alert"` text, e.g. a failed load. Discard is off then. */
  error?: ReactNode
}

/**
 * The save bar fixed to the bottom of the content area (gallery.md §2c,
 * designs/content-editor.dc.html): the unsaved state on the left, Discard and
 * Save on the right. Save is never disabled here; the page decides what it does.
 */
export function SaveBar({ dirty, saving, saved, onSave, onDiscard, error }: SaveBarProps) {
  return (
    <div role="region" aria-label="Save" className={styles.bar}>
      <div className={styles.inner}>
        {error ? (
          <span role="alert" className={styles.error}>
            {error}
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
              disabled={!dirty || saving || !!error}
            >
              Discard
            </Button>
          )}
          <Button variant="bare" font="dashboard" className={styles.save} onClick={onSave}>
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
