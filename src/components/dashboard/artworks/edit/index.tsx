'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

import { DashboardLayout } from '../../DashboardLayout'
import dashboardStyles from '../../DashboardLayout/DashboardLayout.module.scss'
import styles from './edit.module.scss'

type ArtworkEditPageProps = {
  artworkId: string
}

type Artwork = {
  id: string
  userId: string
  name: string
  artworkType: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  description: string | null
  imageUrl: string | null
  featured: boolean
}

export const ArtworkEditPage = ({ artworkId }: ArtworkEditPageProps) => {
  const { data: session } = useSession()
  const router = useRouter()

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    artworkType: 'image',
    title: '',
    author: '',
    year: '',
    technique: '',
    dimensions: '',
    description: '',
    featured: false,
  })



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
          router.push('/dashboard/artworks')
          return
        }

        setArtwork(data)
        setImageUrl(data.imageUrl)
        setFormData({
          name: data.name || '',
          artworkType: data.artworkType || 'image',
          title: data.title || '',
          author: data.author || '',
          year: data.year || '',
          technique: data.technique || '',
          dimensions: data.dimensions || '',
          description: data.description || '',
          featured: data.featured ?? false,
        })
      } catch {
        setError('Failed to load artwork')
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchArtwork()
    }
  }, [artworkId, session?.user?.id, session?.user?.userType, router])

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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

      router.push('/dashboard/artworks')
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

  if (loading) {
    return <DashboardLayout backLink="/dashboard/artworks" backLabel="← Back to Library">Loading...</DashboardLayout>
  }

  if (error && !artwork) {
    return (
      <DashboardLayout backLink="/dashboard/artworks" backLabel="← Back to Library">
        <ErrorText>{error}</ErrorText>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout backLink="/dashboard/artworks" backLabel="← Back to Library">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Edit Artwork</h1>

      {/* Image Upload Section - only for image type */}
      {formData.artworkType === 'image' && (
        <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
          <h3 className={dashboardStyles.sectionTitle}>Artwork Image</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload the artwork image. This will be displayed in exhibitions and on your profile.
          </p>
          <ImageUploader
            imageUrl={imageUrl}
            onUpload={handleImageUpload}
            onRemove={handleRemoveImage}
            uploading={uploading}
            aspectRatio="1 / 1"
            objectFit="contain"
          />
          <span className={dashboardStyles.hint}>
            Accepted: JPG, PNG, WebP, GIF (max 1MB). Images are automatically optimized.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Title Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Title</h3>
          <p className={dashboardStyles.sectionDescription}>
            The display title for your artwork.
          </p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>This will be shown in exhibitions and on your profile.</span>
        </div>

        {/* Type Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Type</h3>
          <p className={dashboardStyles.sectionDescription}>
            The artwork type cannot be changed after creation.
          </p>
          <Input
            id="artworkType"
            type="text"
            size="medium"
            value={formData.artworkType === 'image' ? 'Image' : 'Text'}
            onChange={() => {}}
            variant="disabled"
          />
          <span className={dashboardStyles.hint}>Image for visual artworks, Text for written content.</span>
        </div>

        {/* Author */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Author</h3>
            <Input
              id="author"
              type="text"
              size="medium"
              value={formData.author}
              onChange={(e) => handleChange('author', e.target.value)}
            />
          </div>
        )}

        {/* Year */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Year</h3>
            <Input
              id="year"
              type="text"
              size="medium"
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
            />
          </div>
        )}

        {/* Technique / Medium */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Technique / Medium</h3>
            <RichTextEditor
              content={formData.technique}
              onChange={(content) => handleChange('technique', content)}
              placeholder="e.g. Oil on canvas, mixed media..."
            />
          </div>
        )}

        {/* Dimensions */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Dimensions</h3>
            <Input
              id="dimensions"
              type="text"
              size="medium"
              value={formData.dimensions}
              onChange={(e) => handleChange('dimensions', e.target.value)}
            />
          </div>
        )}

        {/* Description / Text Content */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>
            {formData.artworkType === 'text' ? 'Text Content' : 'Description'}
          </h3>
          <RichTextEditor
            content={formData.description}
            onChange={(content) => handleChange('description', content)}
            placeholder={formData.artworkType === 'text' ? 'Enter the text to display...' : 'About this artwork...'}
          />
        </div>

        {/* Featured Checkbox */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => handleChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={dashboardStyles.actions}>
          <Button font="dashboard" variant="primary" label={saving ? 'Saving...' : 'Save'} type="submit" />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={() => router.push('/dashboard/artworks')}
            type="button"
          />
        </div>
      </form>
    </DashboardLayout>
  )
}
