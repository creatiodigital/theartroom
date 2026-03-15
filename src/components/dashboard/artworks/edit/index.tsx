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
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<ArtworkFormData>(getInitialFormData())

  // Original image URL from server
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  // Pending file to upload (not yet saved)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  // Local preview URL for pending file
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Track if user wants to remove the original image (only delete on save)
  const [pendingImageRemoval, setPendingImageRemoval] = useState(false)

  // Sound state (sound uploads are immediate, not deferred)
  const [soundUrl, setSoundUrl] = useState<string | null>(null)
  const [soundUploading, setSoundUploading] = useState(false)

  // Video state (video uploads are immediate, not deferred)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoUploading, setVideoUploading] = useState(false)

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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
        setOriginalImageUrl(data.imageUrl)
        setSoundUrl(data.soundUrl || null)
        setVideoUrl(data.videoUrl || null)
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
      // Step 1: If there's a pending file, upload it
      if (pendingFile) {
        const uploadFormData = new FormData()
        uploadFormData.append('image', pendingFile)

        const uploadResponse = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'POST',
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          const data = await uploadResponse.json()
          setError(data.error || 'Failed to upload image')
          setSaving(false)
          return
        }
      }
      // Step 2: If image was marked for removal (and no new file), delete it
      else if (pendingImageRemoval && originalImageUrl) {
        const deleteResponse = await fetch(`/api/artworks/${artworkId}/image`, {
          method: 'DELETE',
        })
        if (!deleteResponse.ok) {
          const data = await deleteResponse.json()
          setError(data.error || 'Failed to remove image')
          setSaving(false)
          return
        }
      }

      // Step 3: Update artwork metadata
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

  // Store file locally and create preview (actual upload happens on save)
  const handleImageUpload = useCallback(
    async (file: File) => {
      // Revoke old preview URL if exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      // Create local preview
      const newPreviewUrl = URL.createObjectURL(file)
      setPreviewUrl(newPreviewUrl)
      setPendingFile(file)

      // Clear pending removal since we have a new file
      setPendingImageRemoval(false)
    },
    [previewUrl],
  )

  // Mark image for removal (actual deletion happens on save)
  const handleRemoveImage = useCallback(() => {
    // If there's a pending file, just clear it
    if (pendingFile) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPendingFile(null)
      setPreviewUrl(null)
    } else {
      // Mark original image for removal
      setPendingImageRemoval(true)
    }
  }, [pendingFile, previewUrl])

  // Determine what image URL to display
  const displayImageUrl = pendingFile ? previewUrl : pendingImageRemoval ? null : originalImageUrl

  // Sound upload (immediate - no deferred save needed)
  const handleSoundUpload = useCallback(
    async (file: File) => {
      setSoundUploading(true)
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('sound', file)

        const response = await fetch(`/api/artworks/${artworkId}/sound`, {
          method: 'POST',
          body: uploadFormData,
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to upload sound')
          return
        }

        const data = await response.json()
        setSoundUrl(data.url)
      } catch {
        setError('Failed to upload sound')
      } finally {
        setSoundUploading(false)
      }
    },
    [artworkId],
  )

  const handleSoundRemove = useCallback(async () => {
    try {
      const response = await fetch(`/api/artworks/${artworkId}/sound`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove sound')
        return
      }

      setSoundUrl(null)
    } catch {
      setError('Failed to remove sound')
    }
  }, [artworkId])

  // Video upload (immediate - no deferred save needed)
  const handleVideoUpload = useCallback(
    async (file: File) => {
      setVideoUploading(true)
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('video', file)

        const response = await fetch(`/api/artworks/${artworkId}/video`, {
          method: 'POST',
          body: uploadFormData,
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to upload video')
          return
        }

        const data = await response.json()
        setVideoUrl(data.url)
      } catch {
        setError('Failed to upload video')
      } finally {
        setVideoUploading(false)
      }
    },
    [artworkId],
  )

  const handleVideoRemove = useCallback(async () => {
    try {
      const response = await fetch(`/api/artworks/${artworkId}/video`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to remove video')
        return
      }

      setVideoUrl(null)
    } catch {
      setError('Failed to remove video')
    }
  }, [artworkId])

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
        imageUrl={displayImageUrl}
        soundUrl={soundUrl}
        videoUrl={videoUrl}
        uploading={soundUploading || videoUploading}
        loadingText={videoUploading ? 'Uploading video...' : 'Uploading sound...'}
        saving={saving}
        error={error}
        onFormChange={handleChange}
        onImageUpload={handleImageUpload}
        onImageRemove={handleRemoveImage}
        onSoundUpload={handleSoundUpload}
        onSoundRemove={handleSoundRemove}
        onVideoUpload={handleVideoUpload}
        onVideoRemove={handleVideoRemove}
        onSubmit={handleSubmit}
        onCancel={() => router.push(backLink)}
      />
    </DashboardLayout>
  )
}
