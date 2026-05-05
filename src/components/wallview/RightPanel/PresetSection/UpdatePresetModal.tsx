'use client'

import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './DeletePresetsModal.module.scss'

type Preset = {
  id: string
  name: string
}

type UpdatePresetModalProps = {
  presets: Preset[]
  onUpdate: (presetId: string) => void
  onClose: () => void
  loading: boolean
}

const UpdatePresetModal = ({ presets, onUpdate, onClose, loading }: UpdatePresetModalProps) => {
  return (
    <Modal onClose={onClose}>
      <div className={styles.header}>
        <Text font="dashboard" as="h3" size="sm" weight="bold">
          Update Preset
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
            No presets to update.
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
                label={loading ? 'Updating...' : 'Update'}
                onClick={() => onUpdate(preset.id)}
                disabled={loading}
              />
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

export default UpdatePresetModal
