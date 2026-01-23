'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'

import styles from './ForgotPasswordModal.module.scss'

type ForgotPasswordModalProps = {
  onClose: () => void
  onBack: () => void
}

export const ForgotPasswordModal = ({ onClose, onBack }: ForgotPasswordModalProps) => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email')
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.modal}>
        <Text as="h2">Check Your Email</Text>
        <Text as="p" className={styles.successText}>
          If an account exists with that email, we&apos;ve sent you a link to reset your password.
        </Text>
        <Text as="p" className={styles.hint}>
          Don&apos;t see it? Check your spam folder.
        </Text>
        <div className={styles.actions}>
          <Button size="small" label="Close" onClick={onClose} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.modal}>
      <Text as="h2">Forgot Password</Text>
      <Text as="p" className={styles.description}>
        Enter your email address and we&apos;ll send you a link to reset your password.
      </Text>
      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="forgot-email">Email</label>
          <Input
            id="forgot-email"
            type="email"
            size="medium"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className={styles.actions}>
          <Button
            size="small"
            label={loading ? 'Sending...' : 'Send Reset Link'}
            type="submit"
          />
          <Button
            size="small"
            variant="secondary"
            label="Back to Login"
            onClick={onBack}
            type="button"
          />
        </div>
      </form>
    </div>
  )
}

export default ForgotPasswordModal
