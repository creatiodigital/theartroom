'use client'

import { useState } from 'react'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminSelect } from '@/components/admin/ui/AdminSelect'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { useFormValidation } from '@/hooks/useFormValidation'
import { email, required, validatePassword } from '@/lib/validation'

import styles from './AddArtistModal.module.scss'

// Base user types - admin option added dynamically for superAdmin
const baseUserTypeOptions = [
  { value: 'artist', label: 'Artist' },
  { value: 'curator', label: 'Curator' },
]

const addArtistValidators = {
  name: required('Please enter a first name.'),
  lastName: required('Please enter a last name.'),
  handler: required('Please enter a handler.'),
  email: email(),
  // Optional — a blank password is auto-generated server-side. But if the admin
  // types one, validate its strength here (same rules the server enforces) so
  // they get instant feedback instead of a round-trip 400.
  password: (value: string) => {
    if (!value.trim()) return undefined
    const result = validatePassword(value)
    return result.valid ? undefined : `Password must include ${result.errors.join(', ')}.`
  },
}

// The confirm button sits outside the <form> (in the dialog's button row) and
// submits it through this id.
const FORM_ID = 'add-user-form'

type AddArtistModalProps = {
  onClose: () => void
  onSuccess: () => void
  isSuperAdmin?: boolean
}

export const AddArtistModal = ({
  onClose,
  onSuccess,
  isSuperAdmin = false,
}: AddArtistModalProps) => {
  // Add admin option only for superAdmin users
  const userTypeOptions = isSuperAdmin
    ? [...baseUserTypeOptions, { value: 'admin', label: 'Admin' }]
    : baseUserTypeOptions
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    handler: '',
    email: '',
    password: '',
    userType: 'artist',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [provisionalPassword, setProvisionalPassword] = useState('')

  const {
    validateAll,
    handleChange: validateField,
    fieldError,
  } = useFormValidation(addArtistValidators)

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Auto-generate handler from name and lastName
    if (field === 'name' || field === 'lastName') {
      const newName = field === 'name' ? value : formData.name
      const newLastName = field === 'lastName' ? value : formData.lastName
      const handler = `${newName}-${newLastName}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/--+/g, '-')
      setFormData((prev) => ({ ...prev, handler, [field]: value }))
    }

    // Live-clear validation errors for the validated fields (the `if` also
    // narrows the type to the schema keys).
    if (
      field === 'name' ||
      field === 'lastName' ||
      field === 'handler' ||
      field === 'email' ||
      field === 'password'
    ) {
      validateField(field, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const valid = validateAll({
      name: formData.name,
      lastName: formData.lastName,
      handler: formData.handler,
      email: formData.email,
      password: formData.password,
    })
    if (!valid) return

    setLoading(true)

    try {
      const response = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create artist')
        setLoading(false)
        return
      }

      // If provisional password was generated, show it
      if (data.provisionalPassword) {
        setProvisionalPassword(data.provisionalPassword)
        return // Don't close modal yet, show the password
      }

      onSuccess()
      onClose()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  // One dialog for both screens (same element type in the same place, so React
  // keeps it): the admin dialog layer holds once, and focus goes back to
  // "Add user" when it closes.
  return provisionalPassword ? (
    <AdminConfirmModal
      icon={null}
      title="User created"
      message={
        <div className={styles.created}>
          <p>The following temporary password was generated. Please share it with the artist:</p>
          <div className={styles.provisionalPassword}>
            <code className={styles.code}>{provisionalPassword}</code>
          </div>
          <p className={styles.note}>
            The artist will be asked to set a new password on their first login.
          </p>
        </div>
      }
      confirmLabel="Done"
      cancelLabel={null}
      onConfirm={() => {
        onSuccess()
        onClose()
      }}
      onCancel={onClose}
    />
  ) : (
    <AdminConfirmModal
      size="wide"
      icon={null}
      title="Add user"
      message={
        <form
          id={FORM_ID}
          className={styles.form}
          onSubmit={handleSubmit}
          autoComplete="off"
          noValidate
        >
          <div className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">
                First name
              </label>
              <Input
                id="name"
                type="text"
                size="bare"
                inputClassName={styles.input}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                invalid={!!fieldError('name')}
                required
              />
              <ErrorText className={styles.error}>{fieldError('name')}</ErrorText>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="lastName">
                Last name
              </label>
              <Input
                id="lastName"
                type="text"
                size="bare"
                inputClassName={styles.input}
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                invalid={!!fieldError('lastName')}
                required
              />
              <ErrorText className={styles.error}>{fieldError('lastName')}</ErrorText>
            </div>
          </div>

          <div className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="handler">
                Handler (URL slug)
              </label>
              <Input
                id="handler"
                type="text"
                size="bare"
                inputClassName={styles.input}
                value={formData.handler}
                onChange={(e) => handleChange('handler', e.target.value)}
                invalid={!!fieldError('handler')}
                required
              />
              <ErrorText className={styles.error}>{fieldError('handler')}</ErrorText>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                size="bare"
                inputClassName={styles.input}
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                invalid={!!fieldError('email')}
                autoComplete="off"
                required
              />
              <ErrorText className={styles.error}>{fieldError('email')}</ErrorText>
            </div>
          </div>

          <div className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">
                Password <span className={styles.hint}>(optional — auto-generated if empty)</span>
              </label>
              <Input
                id="password"
                type="password"
                size="bare"
                inputClassName={`${styles.input} ${styles.passwordInput}`}
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                autoComplete="new-password"
                showPasswordToggle
                invalid={!!fieldError('password')}
              />
              <ErrorText className={styles.error}>{fieldError('password')}</ErrorText>
            </div>

            <AdminSelect
              id="userType"
              label="Type"
              size="form"
              value={formData.userType}
              onChange={(val) => handleChange('userType', val)}
            >
              {userTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
          </div>
        </form>
      }
      warning={error || undefined}
      confirmLabel="Create user"
      busyLabel="Creating…"
      busy={loading}
      form={FORM_ID}
      onCancel={onClose}
    />
  )
}
