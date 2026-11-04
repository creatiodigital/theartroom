'use client'

import { use, useCallback, useEffect, useState } from 'react'

import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import { Button } from '@/components/ui/Button'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Toggle } from '@/components/ui/Toggle'

import styles from '../page.module.scss'
import { useAdminGate } from '../useAdminGate'

type Announcement = {
  id: string
  title: string
  content: string
  imageUrl: string | null
  isActive: boolean
}

type PageProps = { params: Promise<{ id: string }> }

/**
 * One announcement: photo, title, text, and whether it shows (AR-174). The photo saves the moment
 * it's uploaded; the rest with Save.
 */
export default function AnnouncementEditor({ params }: PageProps) {
  const { id } = use(params)
  const { loading: sessionLoading, isAdmin } = useAdminGate()
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    fetch(`/api/announcements/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setAnnouncement)
      .catch(() => setLoadError('This announcement could not be loaded.'))
  }, [id, isAdmin])

  const save = async () => {
    if (!announcement) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: announcement.title,
          content: announcement.content,
          isActive: announcement.isActive,
        }),
      })
      if (!response.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setSaveError('The announcement could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = useCallback(
    async (file: File) => {
      setUploading(true)
      setImageError('')
      try {
        const body = new FormData()
        body.append('image', file)
        const response = await fetch(`/api/announcements/${id}/image`, { method: 'POST', body })
        const data = await response.json()
        if (!response.ok) {
          setImageError(data.error || 'Failed to upload the photo')
          return
        }
        setAnnouncement((prev) => (prev ? { ...prev, imageUrl: data.url } : prev))
      } catch {
        setImageError('Failed to upload the photo')
      } finally {
        setUploading(false)
      }
    },
    [id],
  )

  const removePhoto = useCallback(async () => {
    setUploading(true)
    setImageError('')
    try {
      const response = await fetch(`/api/announcements/${id}/image`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      setAnnouncement((prev) => (prev ? { ...prev, imageUrl: null } : prev))
    } catch {
      setImageError('Failed to remove the photo')
    } finally {
      setUploading(false)
    }
  }, [id])

  if (sessionLoading || !isAdmin) {
    return (
      <div className={dashboardStyles.page}>
        <LoadingBar />
      </div>
    )
  }

  return (
    <DashboardLayout backLink="/admin/content/announcements" backLabel="← Back to Announcements">
      <h1 className={dashboardStyles.pageTitle}>Edit Announcement</h1>

      {loadError && <p className={styles.error}>{loadError}</p>}
      {!announcement ? (
        !loadError && <LoadingBar />
      ) : (
        <>
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Show on the homepage</h3>
            <p className={dashboardStyles.sectionDescription}>
              It shows once it has a title and a photo, and only if it is the newest announcement
              switched on. Save to apply.
            </p>
            <Toggle
              checked={announcement.isActive}
              onChange={(e) => setAnnouncement({ ...announcement, isActive: e.target.checked })}
              aria-label="Show on the homepage"
            />
          </div>

          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Photo</h3>
            <p className={dashboardStyles.sectionDescription}>
              The left half of the section, shown as a 3:2 landscape rectangle: a photo of another
              shape is cropped evenly around its center. Saved as soon as it uploads.
            </p>
            <ImageUploader
              imageUrl={announcement.imageUrl}
              onUpload={uploadPhoto}
              onRemove={removePhoto}
              uploading={uploading}
              error={imageError}
              aspectRatio="3 / 2"
            />
            <span className={dashboardStyles.hint}>JPG, PNG, or WebP.</span>
          </div>

          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Title</h3>
            <Input
              id="announcement-title"
              size="medium"
              value={announcement.title}
              onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
            />
          </div>

          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Text</h3>
            <p className={dashboardStyles.sectionDescription}>
              Beside the photo, under the title. Bold, italics and links are kept.
            </p>
            <RichTextEditor
              content={announcement.content}
              onChange={(content) => setAnnouncement({ ...announcement, content })}
              placeholder="Write the announcement..."
            />
          </div>

          {saveError && <p className={styles.error}>{saveError}</p>}
          <div className={dashboardStyles.actions}>
            <Button
              font="dashboard"
              variant="primary"
              label={saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
              onClick={save}
              disabled={saving}
            />
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
