'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'

import styles from './AddArtworkModal.module.scss'

type AddArtworkModalProps = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export const AddArtworkModal = ({ userId, onClose, onSuccess }: AddArtworkModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    artworkType: 'image',
    title: '',
    year: '',
    technique: '',
    dimensions: '',
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageSelect = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, PNG, WebP, or GIF files are allowed!')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      handleImageSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleRemoveImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Create artwork
      const response = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...formData,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to create artwork')
        setLoading(false)
        return
      }

      const artwork = await response.json()

      // 2. Upload image if selected
      if (imageFile && formData.artworkType === 'image') {
        const imageFormData = new FormData()
        imageFormData.append('image', imageFile)

        const uploadResponse = await fetch(`/api/artworks/${artwork.id}/image`, {
          method: 'POST',
          body: imageFormData,
        })

        if (!uploadResponse.ok) {
          console.warn('Failed to upload image, but artwork was created')
        }
      }

      // Cleanup
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
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
      <h2>Add New Artwork</h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="name">Name (Library Display) *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Sunset Painting"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="artworkType">Type</label>
            <select
              id="artworkType"
              value={formData.artworkType}
              onChange={(e) => handleChange('artworkType', e.target.value)}
            >
              <option value="image">Image</option>
              <option value="text">Text</option>
            </select>
          </div>
        </div>

        {/* Image Upload - only shown for image type */}
        {formData.artworkType === 'image' && (
          <div className={styles.imageUpload}>
            <label>Image (optional)</label>
            <div
              className={styles.dropZone}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <div className={styles.previewContainer}>
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    width={150}
                    height={150}
                    style={{ objectFit: 'contain' }}
                  />
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveImage()
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <p>Click or drag image here</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="title">Artwork Title</label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Official artwork title"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="year">Year</label>
            <input
              id="year"
              type="text"
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
              placeholder="e.g. 2024"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="technique">Technique / Medium</label>
            <input
              id="technique"
              type="text"
              value={formData.technique}
              onChange={(e) => handleChange('technique', e.target.value)}
              placeholder="e.g. Oil on canvas"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="dimensions">Dimensions</label>
          <input
            id="dimensions"
            type="text"
            value={formData.dimensions}
            onChange={(e) => handleChange('dimensions', e.target.value)}
            placeholder="e.g. 100 x 80 cm"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            placeholder="About this artwork..."
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button
            variant="small"
            label={loading ? 'Creating...' : 'Create Artwork'}
            type="submit"
          />
          <Button variant="small" label="Cancel" onClick={onClose} type="button" />
        </div>
      </form>
    </div>
  )
}
