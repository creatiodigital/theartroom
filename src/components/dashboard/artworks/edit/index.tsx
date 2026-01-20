'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { DashboardLayout } from '../../DashboardLayout'
import { ErrorText } from '@/components/ui/ErrorText'
import {
  ArtworkEditForm,
  getInitialFormData,
  populateFormData,
} from '@/components/shared/ArtworkEditForm'
import type { Artwork, ArtworkFormData } from '@/components/shared/ArtworkEditForm'

type ArtworkEditPageProps = {
  artworkId: string
}

export const ArtworkEditPage = ({ artworkId }: ArtworkEditPageProps) => {
  const { data: session } = useSession()
  const router = useRouter()
  const backLink = '/dashboard/artworks'

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

        // Verify ownership (allow admin and superAdmin to edit any artwork)
        const userType = session?.user?.userType
        const isAdminOrAbove = userType === 'admin' || userType === 'superAdmin'
        if (data.userId !== session?.user?.id && !isAdminOrAbove) {
          router.push(backLink)
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
  }, [artworkId, session?.user?.id, session?.user?.userType, router, backLink])

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

  if (loading) {
    return (
      <DashboardLayout backLink={backLink} backLabel="← Back to Library">
        Loading...
      </DashboardLayout>
    )
  }

  if (error && !artwork) {
    return (
      <DashboardLayout backLink={backLink} backLabel="← Back to Library">
        <ErrorText>{error}</ErrorText>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout backLink={backLink} backLabel="← Back to Library">
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
        onCancel={() => router.push(backLink)}
      />
    </DashboardLayout>
  )
}
