'use client'

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
  onDelete: (presetId: string) => void
  onClose: () => void
}

const DeletePresetsModal = ({ presets, onDelete, onClose }: DeletePresetsModalProps) => {
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
      <div className={styles.list}>
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
                onClick={() => onDelete(preset.id)}
              />
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

export default DeletePresetsModal
