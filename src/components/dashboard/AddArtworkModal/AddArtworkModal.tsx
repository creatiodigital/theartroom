'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { Input } from '@/components/ui/Input'

import styles from './AddArtworkModal.module.scss'

const artworkTypeOptions = [
  { value: 'image', label: 'Image' },
  { value: 'text', label: 'Text' },
  { value: 'sound', label: 'Sound' },
  { value: 'video', label: 'Video' },
]

// The confirm button sits outside the <form> (in the dialog's button row) and
// submits it through this id.
const FORM_ID = 'add-artwork-form'

type AddArtworkModalProps = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

/**
 * Add artwork (artist.md §2: today's dialog in the admin look, like Add user):
 * labels above the fields, today's help text under them, Cancel / Create artwork.
 */
export const AddArtworkModal = ({ userId, onClose, onSuccess }: AddArtworkModalProps) => {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    artworkType: 'image',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: formData.title,
          artworkType: formData.artworkType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to create artwork')
        setLoading(false)
        return
      }

      const artwork = await response.json()

      onSuccess()
      onClose()

      // Redirect to edit page
      router.push(`/dashboard/artworks/${artwork.id}/edit`)
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <AdminConfirmModal
      icon={null}
      title="Add artwork"
      message={
        <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">
              Title
            </label>
            <Input
              id="title"
              type="text"
              size="bare"
              inputClassName={styles.input}
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Sunset Painting"
            />
            <span className={styles.help}>
              Give your artwork a name. You can change this later. Leave empty to auto-generate a
              title.
            </span>
          </div>

          <div className={styles.field}>
            <AdminSelect
              id="artworkType"
              label="Type"
              size="form"
              value={formData.artworkType}
              onChange={(val) => handleChange('artworkType', val)}
            >
              {artworkTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
            <span className={styles.help}>
              Choose the type of artwork you want to create. Image for visual artworks, Text for
              written content, Sound for audio, Video for video artworks.
            </span>
          </div>
        </form>
      }
      warning={error || undefined}
      confirmLabel="Create artwork"
      busyLabel="Creating…"
      busy={loading}
      form={FORM_ID}
      onCancel={onClose}
    />
  )
}
