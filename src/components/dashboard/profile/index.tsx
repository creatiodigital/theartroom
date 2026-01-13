'use client'

import { useState, useEffect, useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

import { DashboardLayout } from '../DashboardLayout'
import dashboardStyles from '../DashboardLayout/DashboardLayout.module.scss'
import styles from './profile.module.scss'

type User = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  email: string | null
  profileImageUrl: string | null
}

export const DashboardProfilePage = () => {
  const { effectiveUser } = useEffectiveUser()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    handler: '',
    biography: '',
    email: '',
  })



  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!effectiveUser?.id) return

      try {
        const response = await fetch(`/api/users/${effectiveUser.id}`)
        if (!response.ok) {
          setError('Failed to load profile')
          return
        }
        const data = await response.json()
        setUser(data)
        setFormData({
          name: data.name || '',
          lastName: data.lastName || '',
          handler: data.handler || '',
          biography: data.biography || '',
          email: data.email || '',
        })
      } catch {
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    if (effectiveUser?.id) {
      fetchUser()
    }
  }, [effectiveUser?.id])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveUser?.id) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/users/${effectiveUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to update profile')
        setSaving(false)
        return
      }

      setSuccess('Profile updated successfully!')
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!effectiveUser?.id) return

      setUploading(true)
      setError('')

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/users/${effectiveUser.id}/image`, {
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
        setUser((prev) => (prev ? { ...prev, profileImageUrl: data.url } : prev))
        setSuccess('Profile image updated!')
      } catch {
        setError('Failed to upload image')
      } finally {
        setUploading(false)
      }
    },
    [effectiveUser?.id],
  )

  const handleRemoveImage = useCallback(async () => {
    if (!user?.profileImageUrl || !effectiveUser?.id) return

    setUploading(true)
    setError('')

    try {
      const response = await fetch(`/api/users/${effectiveUser.id}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setError('Failed to remove image')
        setUploading(false)
        return
      }

      setUser((prev) => (prev ? { ...prev, profileImageUrl: null } : prev))
      setSuccess('Profile image removed!')
    } catch {
      setError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [user?.profileImageUrl, effectiveUser?.id])

  if (loading) {
    return <DashboardLayout backLink="/dashboard">Loading...</DashboardLayout>
  }

  return (
    <DashboardLayout backLink="/dashboard">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Edit Profile</h1>

      {/* Profile Image Section */}
      <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
        <h3 className={dashboardStyles.sectionTitle}>Profile Picture</h3>
        <p className={dashboardStyles.sectionDescription}>
          Upload a photo to personalize your artist profile. This will be displayed on your public page.
        </p>
        <ImageUploader
          imageUrl={user?.profileImageUrl}
          onUpload={handleImageUpload}
          onRemove={handleRemoveImage}
          uploading={uploading}
          aspectRatio="16 / 10"
        />
        <span className={dashboardStyles.hint}>Recommended: JPG, PNG, or WebP. Max 1MB.</span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Name Row */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Display Name</h3>
          <p className={dashboardStyles.sectionDescription}>
            Your name as it will appear on your public artist profile.
          </p>
          <div className={styles.row}>
            <div className={styles.fieldHalf}>
              <Input
                id="name"
                type="text"
                size="medium"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="First Name"
                required
              />
            </div>
            <div className={styles.fieldHalf}>
              <Input
                id="lastName"
                type="text"
                size="medium"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Last Name"
                required
              />
            </div>
          </div>
          <span className={dashboardStyles.hint}>This is how your name will appear throughout the site.</span>
        </div>

        {/* Handler */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Profile URL</h3>
          <p className={dashboardStyles.sectionDescription}>
            A unique identifier for your profile URL. Use lowercase letters, numbers, and hyphens only.
          </p>
          <Input
            id="handler"
            type="text"
            size="medium"
            value={formData.handler}
            onChange={(e) => handleChange('handler', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>Your profile will be available at: thefoundation.art/artists/{formData.handler || 'your-handle'}</span>
        </div>

        {/* Email */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Email Address</h3>
          <p className={dashboardStyles.sectionDescription}>
            Your contact email. This may be displayed on your public profile.
          </p>
          <Input
            id="email"
            type="email"
            size="medium"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="email@example.com"
          />
          <span className={dashboardStyles.hint}>Leave blank if you prefer not to display your email publicly.</span>
        </div>

        {/* Biography */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Biography</h3>
          <p className={dashboardStyles.sectionDescription}>
            Tell visitors about yourself, your artistic journey, and your work. Supports rich text formatting.
          </p>
          <RichTextEditor
            content={formData.biography}
            onChange={(content) => handleChange('biography', content)}
            placeholder="Tell visitors about yourself..."
          />
          <span className={dashboardStyles.hint}>A well-written biography helps visitors connect with your work.</span>
        </div>

        <ErrorText>{error}</ErrorText>
        {success && (
          <Text font="dashboard" as="p" className={styles.success}>
            {success}
          </Text>
        )}

        <div className={dashboardStyles.actions}>
          <Button font="dashboard" variant="primary" label={saving ? 'Saving...' : 'Save'} type="submit" />
        </div>
      </form>
    </DashboardLayout>
  )
}
