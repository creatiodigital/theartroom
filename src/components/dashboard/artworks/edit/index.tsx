'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
import { HintText } from '@/components/ui/HintText'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Textarea } from '@/components/ui/Textarea'
import { Text } from '@/components/ui/Typography'

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
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
      // Clear input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = async () => {
    if (!imageUrl) return

    if (!confirm('Remove this image?')) return

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
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  if (error && !artwork) {
    return (
      <div className={styles.page}>
        <ErrorText>{error}</ErrorText>
        <Link href="/dashboard/artworks">← Back to Library</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/dashboard/artworks" className={styles.backLink}>
          ← Back to Library
        </Link>
        <Text as="h1">Edit Artwork</Text>
      </div>

      {/* Image Upload Section */}
      <div className={styles.imageSection}>
        <label>Artwork Image (optional)</label>
        <div className={styles.imagePreview}>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt="Artwork preview"
              width={300}
              height={300}
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <div className={styles.noImage}>No image uploaded</div>
          )}
        </div>
        <div className={styles.imageActions}>
          <FileInput
            ref={fileInputRef}
            id="artworkImage"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageUpload}
          />
          <Button
            size="small"
            label={uploading ? 'Uploading...' : imageUrl ? 'Change Image' : 'Upload Image'}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          />
          {imageUrl && (
            <Button size="small" label="Remove" onClick={handleRemoveImage} type="button" />
          )}
        </div>
        <HintText>
          Accepted: JPG, PNG, WebP, GIF (max 10MB). Images are automatically optimized.
        </HintText>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="name">Name (Library Display) *</label>
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
            <label htmlFor="artworkType">Type</label>
            <Input
              id="artworkType"
              type="text"
              size="medium"
              value={formData.artworkType === 'image' ? 'Image' : 'Text'}
              onChange={() => {}}
              variant="disabled"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="title">Artwork Title</label>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="author">Author</label>
          <Input
            id="author"
            type="text"
            size="medium"
            value={formData.author}
            onChange={(e) => handleChange('author', e.target.value)}
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
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Description</label>
          <Textarea
            id="description"
            size="medium"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={4}
          />
        </div>

        {formData.artworkType === 'image' && (
          <div className={styles.field}>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => handleChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={styles.actions}>
          <Button size="small" label={saving ? 'Saving...' : 'Save Changes'} type="submit" />
          <Button
            size="small"
            label="Cancel"
            onClick={() => router.push('/dashboard/artworks')}
            type="button"
          />
        </div>
      </form>
    </div>
  )
}
