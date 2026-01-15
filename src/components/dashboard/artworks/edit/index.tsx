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

// Strip HTML tags from text content (for content saved with RichTextEditor previously)
const stripHtml = (html: string): string => {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersands
    .replace(/&lt;/g, '<') // Replace less than
    .replace(/&gt;/g, '>') // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .trim()
}

type ArtworkEditPageProps = {
  artworkId: string
  returnUrl?: string
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
  textContent: string | null
  featured: boolean
  hiddenFromExhibition: boolean
}

export const ArtworkEditPage = ({ artworkId, returnUrl }: ArtworkEditPageProps) => {
  const { data: session } = useSession()
  const router = useRouter()
  const defaultBackLink = '/dashboard/artworks'
  const backLink = returnUrl || defaultBackLink

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
    textContent: '',
    featured: false,
    hiddenFromExhibition: false,
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
          router.push(backLink)
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
          textContent: stripHtml(data.textContent || ''),
          featured: data.featured ?? false,
          hiddenFromExhibition: data.hiddenFromExhibition ?? false,
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

      router.push(backLink)
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

  const backLabel = returnUrl ? '← Back' : '← Back to Library'
  const isMinimalMode = !!returnUrl

  const handleClose = () => {
    router.push(backLink)
  }

  if (loading) {
    if (isMinimalMode) {
      return (
        <div className={styles.minimalPage}>
          <header className={styles.minimalHeader}>
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE <span className={styles.closeIcon}>×</span>
            </button>
          </header>
          <div className={styles.minimalContent}>Loading...</div>
        </div>
      )
    }
    return (
      <DashboardLayout backLink={backLink} backLabel={backLabel}>
        Loading...
      </DashboardLayout>
    )
  }

  if (error && !artwork) {
    if (isMinimalMode) {
      return (
        <div className={styles.minimalPage}>
          <header className={styles.minimalHeader}>
            <button onClick={handleClose} className={styles.closeButton}>
              CLOSE <span className={styles.closeIcon}>×</span>
            </button>
          </header>
          <div className={styles.minimalContent}>
            <ErrorText>{error}</ErrorText>
          </div>
        </div>
      )
    }
    return (
      <DashboardLayout backLink={backLink} backLabel={backLabel}>
        <ErrorText>{error}</ErrorText>
      </DashboardLayout>
    )
  }

  const formContent = (
    <>
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
          <p className={dashboardStyles.sectionDescription}>The display title for your artwork.</p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>
            This will be shown in exhibitions and on your profile.
          </span>
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
          <span className={dashboardStyles.hint}>
            Image for visual artworks, Text for written content.
          </span>
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

        {/* Text Content - for text artworks (plain text only for 3D) */}
        {formData.artworkType === 'text' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Text Content</h3>
            <p className={dashboardStyles.sectionDescription}>
              Plain text content that will be displayed on the 3D stencil.
            </p>
            <textarea
              value={formData.textContent}
              onChange={(e) => handleChange('textContent', e.target.value)}
              placeholder="Enter the text to display..."
              rows={8}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
            />
            <span className={dashboardStyles.hint}>
              Text styling (font, weight, size) is limited in 3D and can be adjusted in the wall
              panel.
            </span>
          </div>
        )}

        {/* Description - for image artworks (supports rich text) */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Description</h3>
            <RichTextEditor
              content={formData.description}
              onChange={(content) => handleChange('description', content)}
              placeholder="About this artwork..."
            />
          </div>
        )}

        {/* Featured Checkbox */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Featured Artwork</h3>
            <p className={dashboardStyles.sectionDescription}>
              Highlight this artwork on your public artist profile.
            </p>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => handleChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
            <span className={dashboardStyles.hint}>
              Featured artworks appear prominently in your profile&apos;s artwork grid.
            </span>
          </div>
        )}

        {/* Hidden from Exhibition Checkbox */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Exhibition Visibility</h3>
            <p className={dashboardStyles.sectionDescription}>
              Control whether this artwork appears on the exhibition page.
            </p>
            <Checkbox
              checked={formData.hiddenFromExhibition}
              onChange={(e) => handleChange('hiddenFromExhibition', e.target.checked)}
              label="Hide from exhibition page"
            />
            <span className={dashboardStyles.hint}>
              Hidden artworks will still be visible in the 3D space, but won&apos;t appear in the
              exhibition&apos;s artwork list.
            </span>
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={dashboardStyles.actions}>
          <Button
            font="dashboard"
            variant="primary"
            label={saving ? 'Saving...' : 'Save'}
            type="submit"
          />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={() => router.push(backLink)}
            type="button"
          />
        </div>
      </form>
    </>
  )

  if (isMinimalMode) {
    return (
      <div className={styles.minimalPage}>
        <header className={styles.minimalHeader}>
          <button onClick={handleClose} className={styles.closeButton}>
            CLOSE <span className={styles.closeIcon}>×</span>
          </button>
        </header>
        <div className={styles.minimalContent}>{formContent}</div>
      </div>
    )
  }

  return (
    <DashboardLayout backLink={backLink} backLabel={backLabel}>
      {formContent}
    </DashboardLayout>
  )
}
