'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './DeletePresetsModal.module.scss'

type TPresetItem = {
  id: string
  name: string
}

type DeletePresetsModalProps = {
  presets: TPresetItem[]
  onDelete: (presetId: string) => void | Promise<void>
  onClose: () => void
  /** The last delete was refused (questions.md Q146 h). */
  failed?: boolean
}

const DeletePresetsModal = ({
  presets,
  onDelete,
  onClose,
  failed = false,
}: DeletePresetsModalProps) => {
  // Q146 (h): a row's Delete asks first, here in this dialog (a second dialog would close with
  // this one on the same Escape).
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirming = presets.find((preset) => preset.id === confirmingId)

  // The row's Delete goes away with the list: keyboard focus moves to the question, and back to
  // the list after it.
  const questionRef = useRef<HTMLParagraphElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const asked = useRef(false)
  useEffect(() => {
    if (confirmingId) {
      questionRef.current?.focus()
      asked.current = true
    } else if (asked.current) {
      listRef.current?.focus()
      asked.current = false
    }
  }, [confirmingId])

  const handleConfirm = async () => {
    if (!confirming) return
    setDeleting(true)
    try {
      await onDelete(confirming.id)
    } finally {
      setDeleting(false)
      setConfirmingId(null)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className={styles.header}>
        <Text font="dashboard" as="h3" size="sm" weight="bold">
          Delete Presets
        </Text>
        <Button
          variant="ghost"
          icon="close"
          onClick={onClose}
          className={styles.closeBtn}
          title="Close"
          aria-label="Close"
        />
      </div>
      {/* Both views stay in the page and only one shows: a click that swapped them would leave its
          button outside the page, and the wall's "click outside the panels" rule (Wall.tsx) would
          then deselect the work and close this dialog with the right panel. */}
      <div className={styles.confirm} hidden={!confirming}>
        {/* Applying a preset copies its values into the work (applyPresetToArtwork), and the
            delete removes only the preset. */}
        <p ref={questionRef} tabIndex={-1} className={styles.question}>
          {confirming &&
            `Delete “${confirming.name}”? This can't be undone. Works it was applied to keep their settings.`}
        </p>
        <div className={styles.footer}>
          <Button
            font="dashboard"
            size="small"
            variant="secondary"
            label="Cancel"
            onClick={() => setConfirmingId(null)}
            disabled={deleting}
          />
          <Button
            font="dashboard"
            size="small"
            variant="danger"
            label="Delete"
            onClick={handleConfirm}
            disabled={deleting}
          />
        </div>
      </div>
      <div className={styles.listView} hidden={!!confirming}>
        {failed && (
          <p role="alert" className={styles.failed}>
            Not deleted. Please try again.
          </p>
        )}
        <div ref={listRef} tabIndex={-1} className={styles.list}>
          {presets.length === 0 ? (
            <Text font="dashboard" as="p" size="xs" className={styles.empty}>
              No presets to delete.
            </Text>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className={styles.item}>
                <Text font="dashboard" as="span" size="xs" className={styles.name}>
                  {preset.name}
                </Text>
                <Button
                  font="dashboard"
                  size="small"
                  variant="secondary"
                  label="Delete"
                  onClick={() => setConfirmingId(preset.id)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

export default DeletePresetsModal
