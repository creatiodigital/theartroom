'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !effectiveUser?.id) return

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
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = async () => {
    if (!user?.profileImageUrl || !effectiveUser?.id) return
    if (!confirm('Remove profile picture?')) return

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
  }

  if (loading) {
    return <DashboardLayout backLink="/dashboard">Loading...</DashboardLayout>
  }

  return (
    <DashboardLayout backLink="/dashboard">
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Edit Profile</h1>

      {/* Profile Image Section */}
      <div className={styles.imageSection}>
        <label>Profile Picture</label>
        <div className={styles.imageRow}>
          <div className={styles.imagePreview}>
            {user?.profileImageUrl ? (
              <Image
                src={user.profileImageUrl}
                alt="Profile"
                width={120}
                height={120}
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <div className={styles.noImage}>No photo</div>
            )}
          </div>
          <div className={styles.imageActions}>
            <FileInput
              ref={fileInputRef}
              id="profileImage"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
            />
            <Button
              variant="secondary"
              label={uploading ? 'Uploading...' : 'Upload Photo'}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            />
            {user?.profileImageUrl && (
              <Button font="dashboard" variant="primary" label="Remove" onClick={handleRemoveImage} type="button" />
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={dashboardStyles.row}>
          <div className={dashboardStyles.field}>
            <label htmlFor="name">First Name *</label>
            <Input
              id="name"
              type="text"
              size="medium"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>
          <div className={dashboardStyles.field}>
            <label htmlFor="lastName">Last Name *</label>
            <Input
              id="lastName"
              type="text"
              size="medium"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              required
            />
          </div>
        </div>

        <div className={dashboardStyles.field}>
          <label htmlFor="handler">Handler (URL slug) *</label>
          <Input
            id="handler"
            type="text"
            size="medium"
            value={formData.handler}
            onChange={(e) => handleChange('handler', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>This will be part of your public URL</span>
        </div>

        <div className={dashboardStyles.field}>
          <label htmlFor="email">Email</label>
          <Input
            id="email"
            type="email"
            size="medium"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>

        <div className={dashboardStyles.field}>
          <label>Biography</label>
          <RichTextEditor
            content={formData.biography}
            onChange={(content) => handleChange('biography', content)}
            placeholder="Tell visitors about yourself..."
          />
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
