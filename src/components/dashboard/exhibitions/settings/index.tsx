'use client'

import { useEffect, useState, useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'

import { DashboardLayout } from '../../DashboardLayout'
import dashboardStyles from '../../DashboardLayout/DashboardLayout.module.scss'
import styles from './ExhibitionSettings.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  description: string | null
  featuredImageUrl: string | null
  url: string
  userId: string
  status: string
  visibility: string
  startDate: string | null
  endDate: string | null
  user?: {
    handler: string
  }
}

interface ExhibitionSettingsPageProps {
  exhibitionId: string
}

export const ExhibitionSettingsPage = ({ exhibitionId }: ExhibitionSettingsPageProps) => {
  const [exhibition, setExhibition] = useState<Exhibition | null>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)



  // Fetch exhibition data
  useEffect(() => {
    const fetchExhibition = async () => {
      try {
        const response = await fetch(`/api/exhibitions/${exhibitionId}`)
        if (!response.ok) {
          setError('Exhibition not found')
          return
        }
        const data = await response.json()
        setExhibition(data)
        setDescription(data.description || '')
      } catch {
        setError('Failed to load exhibition')
      } finally {
        setLoading(false)
      }
    }

    if (exhibitionId) {
      fetchExhibition()
    }
  }, [exhibitionId])

  const handleSave = useCallback(async () => {
    if (!exhibition) return

    setSaving(true)
    setSaveSuccess(false)
    setError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [exhibition, description])

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!exhibition) return

      setUploading(true)
      setError('')

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/exhibitions/${exhibition.id}/image`, {
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
        setExhibition((prev) => (prev ? { ...prev, featuredImageUrl: data.url } : prev))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch {
        setError('Failed to upload image')
      } finally {
        setUploading(false)
      }
    },
    [exhibition],
  )

  const handleRemoveImage = useCallback(async () => {
    if (!exhibition?.featuredImageUrl) return

    setUploading(true)
    setError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setError('Failed to remove image')
        setUploading(false)
        return
      }

      setExhibition((prev) => (prev ? { ...prev, featuredImageUrl: null } : prev))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [exhibition])

  if (loading) {
    return <DashboardLayout backLink="/dashboard">Loading...</DashboardLayout>
  }

  if (error && !exhibition) {
    return (
      <DashboardLayout backLink="/dashboard">
        <ErrorText>{error}</ErrorText>
      </DashboardLayout>
    )
  }

  if (!exhibition) {
    return (
      <DashboardLayout backLink="/dashboard">
        <ErrorText>Exhibition not found</ErrorText>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout backLink="/dashboard">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>{exhibition.mainTitle}</h1>

      {/* Featured Image Section */}
      <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
        <h3 className={dashboardStyles.sectionTitle}>Featured Image</h3>
        <p className={dashboardStyles.sectionDescription}>
          The main image for your exhibition. This will be displayed on exhibition listings and as a cover.
        </p>
        <ImageUploader
          imageUrl={exhibition.featuredImageUrl}
          onUpload={handleImageUpload}
          onRemove={handleRemoveImage}
          uploading={uploading}
          aspectRatio="16 / 10"
        />
        <span className={dashboardStyles.hint}>Recommended: JPG, PNG, or WebP. Max 1MB.</span>
      </div>

      <div className={dashboardStyles.section}>
        <h3 className={dashboardStyles.sectionTitle}>Description</h3>
        <p className={dashboardStyles.sectionDescription}>
          Tell visitors about this exhibition. Supports rich text formatting.
        </p>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder="Write a description for your exhibition..."
        />
        <span className={dashboardStyles.hint}>A compelling description helps attract visitors to your exhibition.</span>
      </div>

      <div className={dashboardStyles.actions}>
        <Button
          font="dashboard"
          variant="primary"
          label={saving ? 'Saving...' : 'Save'}
          onClick={handleSave}
          disabled={saving}
        />
        {saveSuccess && (
          <Text font="dashboard" as="span" className={styles.successMessage}>
            Saved!
          </Text>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
    </DashboardLayout>
  )
}
