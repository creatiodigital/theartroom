'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useDispatch } from 'react-redux'

import { ErrorText } from '@/components/ui/ErrorText'
import { closeArtworkEditModal } from '@/redux/slices/wallViewSlice'
import {
  ArtworkEditForm,
  getInitialFormData,
  populateFormData,
} from '@/components/shared/ArtworkEditForm'
import type { Artwork, ArtworkFormData } from '@/components/shared/ArtworkEditForm'

import styles from './ArtworkEditModal.module.scss'

type ArtworkEditModalProps = {
  artworkId: string
}

export const ArtworkEditModal = ({ artworkId }: ArtworkEditModalProps) => {
  const { data: session } = useSession()
  const dispatch = useDispatch()

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState<ArtworkFormData>(getInitialFormData())

  // Fetch artwork
  useEffect(() => {
    const fetchArtwork = async () => {
      try {
        const response = await fetch(`/api/artworks/${artworkId}`)
        if (!response.ok) {
          setError('Artwork not found')
          return
        }
        const data = await response.json()

        // Verify ownership
        if (data.userId !== session?.user?.id && session?.user?.userType !== 'admin') {
          dispatch(closeArtworkEditModal())
          return
        }

        setArtwork(data)
        setImageUrl(data.imageUrl)
        setFormData(populateFormData(data))
      } catch {
        setError('Failed to load artwork')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchArtwork()
    }
  }, [artworkId, session?.user?.id, session?.user?.userType, dispatch])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleClose = () => {
    dispatch(closeArtworkEditModal())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/artworks/${artworkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update artwork')
        setSaving(false)
        return
      }

      // Close the modal - data is saved to database
      // The metadata fields (title, author, etc.) aren't visible in 2D wall view
      // so we don't need to update Redux immediately
      dispatch(closeArtworkEditModal())
    } catch {
      setError('Something went wrong')
      setSaving(false)
    }
  }

  const handleImageUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      setError('')

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to upload image')
          setUploading(false)
          return
        }

        const data = await response.json()
        setImageUrl(data.url)
      } catch {
        setError('Failed to upload image')
      } finally {
        setUploading(false)
      }
    },
    [artworkId],
  )

  const handleRemoveImage = useCallback(async () => {
    if (!imageUrl) return

    setUploading(true)
    setError('')

    try {
      const response = await fetch(`/api/artworks/${artworkId}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove image')
        setUploading(false)
        return
      }

      setImageUrl(null)
    } catch {
      setError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [artworkId, imageUrl])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <header className={styles.header}>
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE <span className={styles.closeIcon}>×</span>
            </button>
          </header>
          <div className={styles.content}>Loading...</div>
        </div>
      </div>
    )
  }

  if (error && !artwork) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <header className={styles.header}>
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE <span className={styles.closeIcon}>×</span>
            </button>
          </header>
          <div className={styles.content}>
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <header className={styles.header}>
          <button onClick={handleClose} className={styles.closeButton}>
            CLOSE <span className={styles.closeIcon}>×</span>
          </button>
        </header>
        <div className={styles.content}>
          <ArtworkEditForm
            formData={formData}
            imageUrl={imageUrl}
            uploading={uploading}
            saving={saving}
            error={error}
            onFormChange={handleChange}
            onImageUpload={handleImageUpload}
            onImageRemove={handleRemoveImage}
            onSubmit={handleSubmit}
            onCancel={handleClose}
          />
        </div>
      </div>
    </div>
  )
}
