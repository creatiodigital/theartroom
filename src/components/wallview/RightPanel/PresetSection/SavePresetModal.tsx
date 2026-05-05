'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './SavePresetModal.module.scss'

type SavePresetModalProps = {
  onSave: (name: string) => void
  onClose: () => void
  loading: boolean
  existingNames?: string[]
}

const SavePresetModal = ({
  onSave,
  onClose,
  loading,
  existingNames = [],
}: SavePresetModalProps) => {
  const [name, setName] = useState('')

  const trimmed = name.trim()
  const isDuplicate =
    trimmed.length > 0 && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (trimmed && !isDuplicate) {
      onSave(trimmed)
    }
  }

  return (
    <Modal onClose={onClose}>
      <Text font="dashboard" as="h3" size="sm" weight="bold" className={styles.title}>
        Create Preset
      </Text>
      <form onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <Text font="dashboard" as="label" size="xs" className={styles.label}>
            Preset name
          </Text>
          <Input
            autoFocus
            type="text"
            inputClassName={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Photography Standard"
          />
          {isDuplicate && (
            <Text font="dashboard" as="p" size="xs" className={styles.error}>
              This preset already exists
            </Text>
          )}
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
            label={loading ? 'Saving...' : 'Save'}
            onClick={() => trimmed && !isDuplicate && onSave(trimmed)}
            disabled={!trimmed || isDuplicate || loading}
          />
        </div>
      </form>
    </Modal>
  )
}

export default SavePresetModal
