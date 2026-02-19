'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import Modal from '@/components/ui/Modal/Modal'
import { Select } from '@/components/ui/Select'
import { Text } from '@/components/ui/Typography'

import styles from './SavePresetModal.module.scss'

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
  const [selectedId, setSelectedId] = useState(presets[0]?.id ?? '')

  const options = presets.map((p) => ({ label: p.name, value: p.id }))

  return (
    <Modal onClose={onClose}>
      <Text font="dashboard" as="h3" size="sm" weight="bold" className={styles.title}>
        Update Preset
      </Text>
      <div className={styles.inputGroup}>
        <Text font="dashboard" as="label" size="xs" className={styles.label}>
          Choose preset to update
        </Text>
        <Select<string>
          options={options}
          value={selectedId}
          onChange={(val) => setSelectedId(val)}
        />
      </div>
      <div className={styles.actions}>
        <Button
          font="dashboard"
          size="small"
          variant="secondary"
          label="Cancel"
          onClick={onClose}
        />
        <Button
          font="dashboard"
          size="small"
          variant="primary"
          label={loading ? 'Updating...' : 'Update'}
          onClick={() => selectedId && onUpdate(selectedId)}
          disabled={!selectedId || loading}
        />
      </div>
    </Modal>
  )
}

export default UpdatePresetModal
