'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Text } from '@/components/ui/Typography'

import styles from './AddArtworkModal.module.scss'

const artworkTypeOptions = [
  { value: 'image', label: 'Image' },
  { value: 'text', label: 'Text' },
]

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
    featured: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (field: string, value: string | boolean) => {
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
      <Text as="h2">Add New Artwork</Text>
      <form onSubmit={handleSubmit}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="name">Name (Library Display) *</label>
            <Input
              id="name"
              type="text"
              size="medium"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Sunset Painting"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="artworkType">Type</label>
            <Select
              options={artworkTypeOptions}
              value={formData.artworkType}
              onChange={(val) => handleChange('artworkType', val as string)}
              size="medium"
            />
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
                <Text as="p">Click or drag image here</Text>
              )}
            </div>
            <FileInput
              ref={fileInputRef}
              id="newArtworkImage"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
            />
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="title">Artwork Title</label>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Official artwork title"
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="year">Year</label>
            <Input
              id="year"
              type="text"
              size="medium"
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
              placeholder="e.g. 2024"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="technique">Technique / Medium</label>
            <Input
              id="technique"
              type="text"
              size="medium"
              value={formData.technique}
              onChange={(e) => handleChange('technique', e.target.value)}
              placeholder="e.g. Oil on canvas"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="dimensions">Dimensions</label>
          <Input
            id="dimensions"
            type="text"
            size="medium"
            value={formData.dimensions}
            onChange={(e) => handleChange('dimensions', e.target.value)}
            placeholder="e.g. 100 x 80 cm"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Description</label>
          <Textarea
            id="description"
            size="medium"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            placeholder="About this artwork..."
          />
        </div>

        {formData.artworkType === 'image' && (
          <div className={styles.checkboxField}>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => handleChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={styles.actions}>
          <Button
            size="small"
            label={loading ? 'Creating...' : 'Create Artwork'}
            type="submit"
          />
          <Button size="small" label="Cancel" onClick={onClose} type="button" />
        </div>
      </form>
    </div>
  )
}
