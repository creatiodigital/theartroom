'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowSquareOut } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { SaveBar } from '@/components/admin/ui/SaveBar'
import { ErrorText } from '@/components/ui/ErrorText'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { useEffectiveUser } from '@/hooks/useEffectiveUser'
import { useFormValidation } from '@/hooks/useFormValidation'
import { isEmail, required } from '@/lib/validation'

import { StudioPanel } from '../StudioPanel'
import page from '../StudioPanel/studioPage.module.scss'
import styles from './profile.module.scss'

type User = {
  id: string
  name: string
  lastName: string
  handler: string
  biography: string
  email: string | null
  profileImageUrl: string | null
  signatureUrl: string | null
}

/** What the form sends; also its last loaded or saved values (the save bar's baseline). */
type ProfileForm = {
  name: string
  lastName: string
  handler: string
  biography: string
  email: string
}

/** The bar's Save changes submits this form (Enter in its fields too). */
const PROFILE_FORM_ID = 'profile-form'

const profileValidators = {
  name: required('Please enter your first name.'),
  lastName: required('Please enter your last name.'),
  handler: required('Please enter a profile URL.'),
  // Required + format-checked.
  email: (value: string) =>
    !value.trim()
      ? 'Please enter your email address.'
      : isEmail(value)
        ? undefined
        : 'Please enter a valid email address.',
}

export const DashboardProfilePage = () => {
  const { effectiveUser } = useEffectiveUser()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [error, setError] = useState('')
  const [profileImageError, setProfileImageError] = useState('')
  const [signatureError, setSignatureError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    handler: '',
    biography: '',
    email: '',
  })

  // The save bar's state (display only: nothing here is sent). The baseline is
  // the last loaded or saved form; the biography editor's own rewrite of the
  // loaded text (reported once through onReady) is not a change.
  const [baseline, setBaseline] = useState<ProfileForm | null>(null)
  const [editorBio, setEditorBio] = useState<string | null>(null)
  // The form a refused save sent, while nothing has changed since (questions.md Q80).
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

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
        const loaded = {
          name: data.name || '',
          lastName: data.lastName || '',
          handler: data.handler || '',
          biography: data.biography || '',
          email: data.email || '',
        }
        setFormData(loaded)
        setBaseline(loaded)
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

  const {
    validateAll,
    handleChange: validateField,
    fieldError,
    reset: resetValidation,
  } = useFormValidation(profileValidators)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSuccess('')
    // Live-clear validation errors for the validated fields (the `if` also
    // narrows the type to the schema keys).
    if (field === 'name' || field === 'lastName' || field === 'handler' || field === 'email') {
      validateField(field, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveUser?.id) return

    const valid = validateAll({
      name: formData.name,
      lastName: formData.lastName,
      handler: formData.handler,
      email: formData.email,
    })
    if (!valid) return

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
        setFailedKey(JSON.stringify(formData))
        const data = await response.json()
        setError(data.error || 'Failed to update profile')
        setSaving(false)
        return
      }

      setSuccess('Profile updated successfully!')
      setBaseline(formData)
      setFailedKey(null)
    } catch {
      setError('Something went wrong')
      setFailedKey(JSON.stringify(formData))
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!effectiveUser?.id) return

      setUploading(true)
      setProfileImageError('')

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/users/${effectiveUser.id}/image`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          setProfileImageError(data.error || 'Failed to upload image')
          setUploading(false)
          return
        }

        const data = await response.json()
        setUser((prev) => (prev ? { ...prev, profileImageUrl: data.url } : prev))
        setSuccess('Profile image updated!')
      } catch {
        setProfileImageError('Failed to upload image')
      } finally {
        setUploading(false)
      }
    },
    [effectiveUser?.id],
  )

  const handleSignatureUpload = useCallback(
    async (file: File) => {
      if (!effectiveUser?.id) return

      setUploadingSignature(true)
      setSignatureError('')

      try {
        const body = new FormData()
        body.append('image', file)

        const response = await fetch(`/api/users/${effectiveUser.id}/signature`, {
          method: 'POST',
          body,
        })

        const data = await response.json()
        if (!response.ok) {
          setSignatureError(data.error || 'Failed to upload signature')
          setUploadingSignature(false)
          return
        }

        setUser((prev) => (prev ? { ...prev, signatureUrl: data.url } : prev))
        setSuccess('Signature updated!')
      } catch {
        setSignatureError('Failed to upload signature')
      } finally {
        setUploadingSignature(false)
      }
    },
    [effectiveUser?.id],
  )

  const handleRemoveSignature = useCallback(async () => {
    if (!user?.signatureUrl || !effectiveUser?.id) return

    setUploadingSignature(true)
    setSignatureError('')

    try {
      const response = await fetch(`/api/users/${effectiveUser.id}/signature`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setSignatureError('Failed to remove signature')
        setUploadingSignature(false)
        return
      }

      setUser((prev) => (prev ? { ...prev, signatureUrl: null } : prev))
      setSuccess('Signature removed!')
    } catch {
      setSignatureError('Failed to remove signature')
    } finally {
      setUploadingSignature(false)
    }
  }, [user?.signatureUrl, effectiveUser?.id])

  const handleRemoveImage = useCallback(async () => {
    if (!user?.profileImageUrl || !effectiveUser?.id) return

    setUploading(true)
    setProfileImageError('')

    try {
      const response = await fetch(`/api/users/${effectiveUser.id}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setProfileImageError('Failed to remove image')
        setUploading(false)
        return
      }

      setUser((prev) => (prev ? { ...prev, profileImageUrl: null } : prev))
      setSuccess('Profile image removed!')
    } catch {
      setProfileImageError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [user?.profileImageUrl, effectiveUser?.id])

  const onBioReady = useCallback((html: string) => setEditorBio(html), [])

  const bioChanged =
    baseline !== null &&
    editorBio !== null &&
    formData.biography !== baseline.biography &&
    formData.biography !== editorBio
  const dirty =
    baseline !== null &&
    (formData.name !== baseline.name ||
      formData.lastName !== baseline.lastName ||
      formData.handler !== baseline.handler ||
      formData.email !== baseline.email ||
      bioChanged)
  const failed = failedKey !== null && failedKey === JSON.stringify(formData)

  // Discard (asked first) puts back the last loaded or saved form, with no
  // request; the restored fields lose any validation red. The picture and the
  // signature save on their own and are left as they are.
  const confirmDiscard = () => {
    if (baseline) setFormData(baseline)
    resetValidation()
    setFailedKey(null)
    setConfirmingDiscard(false)
  }

  // With unsaved changes, reloading, closing the tab or typing a URL asks the
  // browser's own "Leave site?" (as the page editor, Q81 / Q118). In-app links
  // (the menu) are not caught.
  useEffect(() => {
    if (!dirty) return
    const askFirst = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chrome asks only when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', askFirst)
    return () => window.removeEventListener('beforeunload', askFirst)
  }, [dirty])

  // The saved handler's public page, in a new tab (it follows a saved URL change).
  const publicHref = baseline?.handler ? `/artists/${baseline.handler}` : null

  const header = (
    <AdminPageHeader
      title="Profile"
      description="How you appear to visitors on your public artist page."
      actions={
        publicHref ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            className={page.outline}
          >
            View my public page
            <ArrowSquareOut size={14} weight="light" aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        ) : undefined
      }
    />
  )

  if (loading) {
    return (
      <div className={page.page}>
        {header}
        <p className={page.status}>Loading profile…</p>
      </div>
    )
  }

  // The record is set only by a load that succeeded (questions.md Q128 a): after
  // a refused or failed one, no form and no save bar, so an empty form can't be
  // saved over the profile.
  if (!user) {
    return (
      <div className={page.page}>
        {header}
        <Callout tone="red" role="alert">
          The profile could not be loaded.
        </Callout>
      </div>
    )
  }

  return (
    <div className={c(page.page, page.withSaveBar)}>
      {header}

      <StudioPanel
        title="Profile picture"
        description="Upload a photo to personalize your artist profile. This will be displayed on your public page."
      >
        <ImageUploader
          tone="admin"
          adminPreview="avatar"
          imageUrl={user.profileImageUrl}
          onUpload={handleImageUpload}
          onRemove={handleRemoveImage}
          uploading={uploading}
          error={profileImageError}
          note="Recommended: JPG, PNG, or WebP. Max 1MB."
        />
      </StudioPanel>

      <StudioPanel
        title="Artist signature"
        description={
          <>
            Upload a scan or photo of your handwritten signature. It is supplied to the print lab
            for your <strong>signed limited editions</strong>. It reassures the buyer the piece is
            genuine, and keeps your work traceable back to you.
          </>
        }
      >
        <ImageUploader
          tone="admin"
          adminPreview="signature"
          aspectRatio="3 / 1"
          objectFit="contain"
          imageUrl={user.signatureUrl}
          onUpload={handleSignatureUpload}
          onRemove={handleRemoveSignature}
          uploading={uploadingSignature}
          error={signatureError}
          note="Transparent PNG only. Minimum 600 × 200 pixels. Keep the background fully transparent: your signature should float over the certificate, not sit in a white box."
        />
      </StudioPanel>

      <form id={PROFILE_FORM_ID} onSubmit={handleSubmit} noValidate className={styles.form}>
        <StudioPanel title="About you" className={styles.about}>
          <div className={styles.nameGroup}>
            <div className={styles.names}>
              <div className={page.field}>
                <label htmlFor="name" className={page.label}>
                  First name
                </label>
                <Input
                  id="name"
                  type="text"
                  size="bare"
                  inputClassName={page.input}
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  invalid={!!fieldError('name')}
                  required
                  aria-describedby="profile-name-help"
                />
                <ErrorText className={page.fieldError}>{fieldError('name')}</ErrorText>
              </div>
              <div className={page.field}>
                <label htmlFor="lastName" className={page.label}>
                  Last name
                </label>
                <Input
                  id="lastName"
                  type="text"
                  size="bare"
                  inputClassName={page.input}
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  invalid={!!fieldError('lastName')}
                  required
                  aria-describedby="profile-name-help"
                />
                <ErrorText className={page.fieldError}>{fieldError('lastName')}</ErrorText>
              </div>
            </div>
            <p id="profile-name-help" className={page.help}>
              Your name as it will appear on your public artist profile.
            </p>
          </div>

          <div className={page.field}>
            <label htmlFor="handler" className={page.label}>
              Profile URL
            </label>
            <div className={page.prefixBox}>
              <span id="profile-url-prefix" className={page.prefix}>
                theartroom.gallery/artists/
              </span>
              <Input
                id="handler"
                type="text"
                size="bare"
                className={page.prefixField}
                inputClassName={page.prefixInput}
                value={formData.handler}
                onChange={(e) => handleChange('handler', e.target.value)}
                placeholder="your-handle"
                invalid={!!fieldError('handler')}
                required
                aria-describedby="profile-url-prefix profile-url-help"
              />
            </div>
            <ErrorText className={page.fieldError}>{fieldError('handler')}</ErrorText>
            <p id="profile-url-help" className={page.help}>
              Lowercase letters, numbers and hyphens only.
            </p>
          </div>

          <div className={page.field}>
            <label htmlFor="email" className={page.label}>
              Email address
            </label>
            <Input
              id="email"
              type="email"
              size="bare"
              inputClassName={page.input}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@example.com"
              invalid={!!fieldError('email')}
              required
              aria-describedby="profile-email-help"
            />
            <ErrorText className={page.fieldError}>{fieldError('email')}</ErrorText>
            <p id="profile-email-help" className={page.help}>
              Your contact email. This may be displayed on your public profile. Required so the
              gallery can reach you about your work.
            </p>
          </div>
        </StudioPanel>

        <StudioPanel
          id="profile-biography"
          title="Biography"
          description="Tell visitors about yourself, your artistic journey, and your work. Supports rich text formatting."
        >
          <RichTextEditor
            tone="admin"
            labelledBy="profile-biography-title"
            describedBy="profile-biography-description profile-biography-help"
            content={formData.biography}
            onChange={(content) => handleChange('biography', content)}
            onReady={onBioReady}
            placeholder="Tell visitors about yourself…"
          />
          <p id="profile-biography-help" className={page.help}>
            A well-written biography helps visitors connect with your work.
          </p>
        </StudioPanel>

        {error && (
          <Callout tone="red" role="alert">
            {error}
          </Callout>
        )}
        {success && (
          <FeedbackBar tone="success" onDismiss={() => setSuccess('')}>
            {success}
          </FeedbackBar>
        )}
      </form>

      <SaveBar
        form={PROFILE_FORM_ID}
        dirty={dirty}
        saving={saving}
        saved={success !== ''}
        failed={failed}
        onDiscard={() => setConfirmingDiscard(true)}
      />

      {confirmingDiscard && (
        <AdminConfirmModal
          title="Discard changes?"
          message="Your changes since the last save will be lost."
          confirmLabel="Discard"
          destructive
          onConfirm={confirmDiscard}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  )
}
