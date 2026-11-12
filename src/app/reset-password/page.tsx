'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Check } from '@phosphor-icons/react'

import { PasswordFields } from '@/components/auth/PasswordFields'
import { ArrowLink } from '@/components/ui/ArrowLink'
import { Button } from '@/components/ui/Button'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { PageLayout } from '@/components/ui/PageLayout'
import { validatePassword } from '@/lib/validation'

import { scrollToFirstError } from '@/lib/validation/scrollToFirstError'
import styles from './reset-password.module.scss'

const ResetPasswordForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Held in state, then removed from the address bar on mount (below): a live
  // reset credential should not sit in the URL, where analytics page views and
  // shared screenshots pick it up. State keeps it once the URL no longer has it.
  const [token] = useState(() => searchParams.get('token'))

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Per-field errors (password strength + match). `error` stays for
  // form-level problems (invalid token, server failure).
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>(
    {},
  )
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
  }, [token])

  // Strength via the shared `validatePassword` (one rule, client + server) plus
  // the cross-field match check.
  const computeFieldErrors = (pw: string, confirm: string) => {
    const next: { password?: string; confirmPassword?: string } = {}
    const result = validatePassword(pw)
    if (!result.valid) next.password = `Password must include ${result.errors.join(', ')}.`
    if (confirm !== pw) next.confirmPassword = 'Passwords don’t match.'
    return next
  }

  // House flow: errors only after the first submit, then re-checked live as the
  // user edits either field (so the match error clears once they line up).
  const revalidate = (pw: string, confirm: string) => {
    if (submitAttempted) setFieldErrors(computeFieldErrors(pw, confirm))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitAttempted(true)

    const nextErrors = computeFieldErrors(password, confirmPassword)
    setFieldErrors(nextErrors)
    if (nextErrors.password || nextErrors.confirmPassword) {
      scrollToFirstError()
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

  // other-screens.md "Reset password": a centred 420 px column, the shared fields and checklist, a
  // black full-width button, server errors as one red line under it; the done state in its place.
  if (success) {
    return (
      <div className={styles.container}>
        <span className={styles.doneMark} aria-hidden>
          <Check size={22} weight="light" />
        </span>
        <h1 className={styles.title}>Your password is updated.</h1>
        <p className={styles.subtitle}>You can now sign in with your new password.</p>
        <ArrowLink href="/">Back to the home page</ArrowLink>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Reset your password</h1>
      <p className={styles.subtitle}>Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <PasswordFields
          ids={{ password: 'password', confirm: 'confirmPassword' }}
          password={password}
          confirm={confirmPassword}
          onPasswordChange={(next) => {
            setPassword(next)
            revalidate(next, confirmPassword)
          }}
          onConfirmChange={(next) => {
            setConfirmPassword(next)
            revalidate(password, next)
          }}
          passwordError={fieldErrors.password}
          confirmError={fieldErrors.confirmPassword}
        />

        <Button
          variant="primary"
          label={loading ? 'Resetting…' : 'Reset password'}
          type="submit"
          className={styles.submitButton}
        />
        {/* No page to request a new link from (only the sign-in window's), so the line alone. */}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
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
