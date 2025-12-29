'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { H2 } from '@/components/ui/Typography'

import styles from './AddArtistModal.module.scss'

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
      <H2>Add New Artist</H2>
      <form onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="name">First Name *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              type="text"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="handler">Handler (URL slug) *</label>
          <input
            id="handler"
            type="text"
            value={formData.handler}
            onChange={(e) => handleChange('handler', e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="biography">Biography</label>
          <textarea
            id="biography"
            value={formData.biography}
            onChange={(e) => handleChange('biography', e.target.value)}
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="userType">Type</label>
          <select
            id="userType"
            value={formData.userType}
            onChange={(e) => handleChange('userType', e.target.value)}
          >
            <option value="artist">Artist</option>
            <option value="curator">Curator</option>
          </select>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button variant="small" label={loading ? 'Creating...' : 'Create Artist'} type="submit" />
          <Button variant="small" label="Cancel" onClick={onClose} type="button" />
        </div>
      </form>
    </div>
  )
}
