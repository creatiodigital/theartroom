'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'

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
  const { status: sessionStatus } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exhibition, setExhibition] = useState<Exhibition | null>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !exhibition) return

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
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = async () => {
    if (!exhibition?.featuredImageUrl) return
    if (!confirm('Remove featured image?')) return

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
  }

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  if (error && !exhibition) {
    return (
      <div className={styles.page}>
        <ErrorText>{error}</ErrorText>
        <Link href="/dashboard">← Back to Dashboard</Link>
      </div>
    )
  }

  if (!exhibition) {
    return (
      <div className={styles.page}>
        <ErrorText>Exhibition not found</ErrorText>
        <Link href="/dashboard">← Back to Dashboard</Link>
      </div>
    )
  }

  const editUrl = exhibition.user?.handler
    ? `/exhibitions/${exhibition.user.handler}/${exhibition.url}/edit`
    : `/dashboard`

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href={editUrl} className={styles.backLink}>
          ← Back to Editor
        </Link>
      </div>

      <Text as="h1" className={styles.pageTitle}>
        {exhibition.mainTitle}
      </Text>

      {/* Featured Image Section */}
      <div className={styles.section}>
        <Text as="h3" font="sans" className={styles.sectionTitle}>
          Featured Image
        </Text>
        <div className={styles.imageRow}>
          <div className={styles.imagePreview}>
            {exhibition.featuredImageUrl ? (
              <Image
                src={exhibition.featuredImageUrl}
                alt="Featured"
                width={300}
                height={200}
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div className={styles.noImage}>No image</div>
            )}
          </div>
          <div className={styles.imageActions}>
            <FileInput
              ref={fileInputRef}
              id="featuredImage"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
            />
            <Button
              size="small"
              label={uploading ? 'Uploading...' : exhibition.featuredImageUrl ? 'Change Image' : 'Upload Image'}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            />
            {exhibition.featuredImageUrl && (
              <Button size="small" label="Remove" onClick={handleRemoveImage} type="button" />
            )}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Text as="h3" font="sans" className={styles.sectionTitle}>
          Description
        </Text>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder="Write a description for your exhibition..."
        />
      </div>

      <div className={styles.actions}>
        <Button
          size="small"
          label={saving ? 'Saving...' : 'Save Changes'}
          onClick={handleSave}
          disabled={saving}
        />
        {saveSuccess && (
          <Text as="span" className={styles.successMessage}>
            Saved!
          </Text>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}
