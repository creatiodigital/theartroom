'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'

import styles from './ChangePasswordPage.module.scss'

export const ChangePasswordPage = () => {
  const router = useRouter()
  const { update: updateSession } = useSession()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newPassword) {
      setError('Please enter a new password')
      return
    }

    if (!confirmPassword) {
      setError('Please confirm your password')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to change password')
        setSubmitting(false)
        return
      }

      // Refresh session to clear mustChangePassword flag
      await updateSession({})

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Text font="dashboard" as="h1">
          Set Your Password
        </Text>
        <Text font="dashboard" as="p" className={styles.subtitle}>
          For security, please create a new password to replace the temporary one.
        </Text>

        <div className={styles.requirements}>
          <Text font="dashboard" as="p" className={styles.requirementsTitle}>
            Password requirements:
          </Text>
          <ul>
            <li>At least 8 characters</li>
            <li>At least one uppercase letter</li>
            <li>At least one lowercase letter</li>
            <li>At least one number</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="newPassword">New Password</label>
            <Input
              id="newPassword"
              type="password"
              size="medium"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              showPasswordToggle
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <Input
              id="confirmPassword"
              type="password"
              size="medium"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              showPasswordToggle
            />
          </div>

          <ErrorText>{error}</ErrorText>

          <Button
            font="dashboard"
            variant="primary"
            label={submitting ? 'Saving...' : 'Set Password'}
            type="submit"
          />
        </form>
      </div>
    </div>
  )
}
