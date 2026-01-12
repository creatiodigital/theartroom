'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Text } from '@/components/ui/Typography'

import styles from './AddArtistModal.module.scss'

const userTypeOptions = [
  { value: 'artist', label: 'Artist' },
  { value: 'curator', label: 'Curator' },
]

type AddArtistModalProps = {
  onClose: () => void
  onSuccess: () => void
}

export const AddArtistModal = ({ onClose, onSuccess }: AddArtistModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    handler: '',
    email: '',
    biography: '',
    password: '',
    userType: 'artist',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Auto-generate handler from name and lastName
    if (field === 'name' || field === 'lastName') {
      const newName = field === 'name' ? value : formData.name
      const newLastName = field === 'lastName' ? value : formData.lastName
      const handler = `${newName}-${newLastName}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/--+/g, '-')
      setFormData((prev) => ({ ...prev, handler, [field]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to create artist')
        setLoading(false)
        return
      }

      onSuccess()
      onClose()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className={styles.modal}>
      <Text font="dashboard" as="h2">Add New Artist</Text>
      <form onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="name">First Name *</label>
            <Input
              id="name"
              type="text"
              size="medium"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="lastName">Last Name *</label>
            <Input
              id="lastName"
              type="text"
              size="medium"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="handler">Handler (URL slug) *</label>
          <Input
            id="handler"
            type="text"
            size="medium"
            value={formData.handler}
            onChange={(e) => handleChange('handler', e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email *</label>
          <Input
            id="email"
            type="email"
            size="medium"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <Input
            id="password"
            type="password"
            size="medium"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="biography">Biography</label>
          <Textarea
            id="biography"
            size="medium"
            value={formData.biography}
            onChange={(e) => handleChange('biography', e.target.value)}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="userType">Type</label>
          <Select
            options={userTypeOptions}
            value={formData.userType}
            onChange={(val) => handleChange('userType', val as string)}
            size="medium"
          />
        </div>

        <ErrorText>{error}</ErrorText>

        <div className={styles.actions}>
          <Button font="dashboard" variant="secondary" label={loading ? 'Creating...' : 'Create Artist'} type="submit" />
          <Button font="dashboard" variant="secondary" label="Cancel" onClick={onClose} type="button" />
        </div>
      </form>
    </div>
  )
}
