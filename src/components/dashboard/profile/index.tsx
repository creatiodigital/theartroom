'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'

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
  const { status: sessionStatus } = useSession()
  const { effectiveUser } = useEffectiveUser()
  const router = useRouter()
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

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

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

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/dashboard" className={styles.backLink}>
          ← Back to Dashboard
        </Link>
        <Button variant="link" label="Log out" onClick={() => signOut({ callbackUrl: '/' })} />
      </div>

      <Text as="h1" className={styles.title}>
        Edit Profile
      </Text>

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
              variant="small"
              label={uploading ? 'Uploading...' : 'Upload Photo'}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            />
            {user?.profileImageUrl && (
              <Button variant="small" label="Remove" onClick={handleRemoveImage} type="button" />
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <div className={styles.field}>
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
          <div className={styles.field}>
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

        <div className={styles.field}>
          <label htmlFor="handler">Handler (URL slug) *</label>
          <Input
            id="handler"
            type="text"
            size="medium"
            value={formData.handler}
            onChange={(e) => handleChange('handler', e.target.value)}
            required
          />
          <span className={styles.hint}>This will be part of your public URL</span>
        </div>

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <Input
            id="email"
            type="email"
            size="medium"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Biography</label>
          <RichTextEditor
            content={formData.biography}
            onChange={(content) => handleChange('biography', content)}
            placeholder="Tell visitors about yourself..."
          />
        </div>

        <ErrorText>{error}</ErrorText>
        {success && (
          <Text as="p" className={styles.success}>
            {success}
          </Text>
        )}

        <div className={styles.actions}>
          <Button variant="small" label={saving ? 'Saving...' : 'Save Changes'} type="submit" />
        </div>
      </form>
    </div>
  )
}
