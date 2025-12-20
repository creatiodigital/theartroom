'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'

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
}

export const ArtworkEditPage = ({ artworkId }: ArtworkEditPageProps) => {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    artworkType: 'image',
    title: '',
    author: '',
    year: '',
    technique: '',
    dimensions: '',
    description: '',
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
        setFormData({
          name: data.name || '',
          artworkType: data.artworkType || 'image',
          title: data.title || '',
          author: data.author || '',
          year: data.year || '',
          technique: data.technique || '',
          dimensions: data.dimensions || '',
          description: data.description || '',
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

  const handleChange = (field: string, value: string) => {
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

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error && !artwork) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <Link href="/dashboard/artworks">← Back to Library</Link>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/dashboard/artworks" className={styles.backLink}>← Back to Library</Link>
        <h1>Edit Artwork</h1>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor="name">Name (Library Display) *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
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

        <div className={styles.field}>
          <label htmlFor="title">Artwork Title</label>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="author">Author</label>
          <input
            id="author"
            type="text"
            value={formData.author}
            onChange={(e) => handleChange('author', e.target.value)}
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
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="technique">Technique / Medium</label>
            <input
              id="technique"
              type="text"
              value={formData.technique}
              onChange={(e) => handleChange('technique', e.target.value)}
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
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={4}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button
            variant="small"
            label={saving ? 'Saving...' : 'Save Changes'}
            type="submit"
          />
          <Button
            variant="small"
            label="Cancel"
            onClick={() => router.push('/dashboard/artworks')}
            type="button"
          />
        </div>
      </form>
    </div>
  )
}
