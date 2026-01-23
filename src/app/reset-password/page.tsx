'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { PageLayout } from '@/components/ui/PageLayout'
import { Text } from '@/components/ui/Typography'

import styles from './reset-password.module.scss'

const ResetPasswordForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
        setLoading(false)
        return
      }

      setSuccess(true)
      // Redirect to home after 3 seconds
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.container}>
        <Text as="h1" size="2xl" font="serif" className={styles.title}>
          Password Reset Successfully
        </Text>
        <Text as="p" className={styles.subtitle}>
          Your password has been updated. You can now log in with your new password.
        </Text>
        <Text as="p" className={styles.redirect}>
          Redirecting to home page...
        </Text>
        <Link href="/" className={styles.link}>
          Go to Home
        </Link>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <Text as="h1" size="2xl" font="serif" className={styles.title}>
        Reset Your Password
      </Text>
      <Text as="p" className={styles.subtitle}>
        Enter your new password below.
      </Text>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="password">New Password</label>
          <Input
            id="password"
            type="password"
            size="medium"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showPasswordToggle
            required
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
            showPasswordToggle
            required
          />
        </div>

        <ErrorText>{error}</ErrorText>

        <Button
          variant="primary"
          size="regularSquared"
          label={loading ? 'Resetting...' : 'Reset Password'}
          type="submit"
          className={styles.submitButton}
        />
      </form>

      <Link href="/" className={styles.link}>
        Back to Home
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <PageLayout>
      <Suspense fallback={<LoadingBar />}>
        <ResetPasswordForm />
      </Suspense>
    </PageLayout>
  )
}
