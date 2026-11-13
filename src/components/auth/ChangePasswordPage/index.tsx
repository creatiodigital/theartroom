'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { PasswordFields } from '@/components/auth/PasswordFields'
import { Button } from '@/components/ui/Button'
import Logo from '@/icons/logo.svg'
import { validatePassword } from '@/lib/validation'

import { scrollToFirstError } from '@/lib/validation/scrollToFirstError'
import styles from './ChangePasswordPage.module.scss'

export const ChangePasswordPage = () => {
  const router = useRouter()
  const { update: updateSession } = useSession()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // Per-field errors (strength + match). `error` stays for server failures.
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Strength via the shared `validatePassword` (one rule, client + server) plus
  // the cross-field match check.
  const computeFieldErrors = (pw: string, confirm: string) => {
    const next: { newPassword?: string; confirmPassword?: string } = {}
    const result = validatePassword(pw)
    if (!result.valid) next.newPassword = `Password must include ${result.errors.join(', ')}.`
    if (confirm !== pw) next.confirmPassword = 'Passwords don’t match.'
    return next
  }

  // House flow: errors only after the first submit, then re-checked live.
  const revalidate = (pw: string, confirm: string) => {
    if (submitAttempted) setFieldErrors(computeFieldErrors(pw, confirm))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitAttempted(true)

    const nextErrors = computeFieldErrors(newPassword, confirmPassword)
    setFieldErrors(nextErrors)
    if (nextErrors.newPassword || nextErrors.confirmPassword) {
      scrollToFirstError()
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

  // other-screens.md "Set your password": the studio look (a white card on #fafaf9, no header), the
  // real logo, the same fields, checklist and mismatch line as the public reset page.
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Logo className={styles.logo} role="img" aria-label="The Art Room" />
        <h1 className={styles.title}>Set your password</h1>
        <p className={styles.subtitle}>
          For security, replace the temporary password with one of your own.
        </p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <PasswordFields
            ids={{ password: 'newPassword', confirm: 'confirmPassword' }}
            password={newPassword}
            confirm={confirmPassword}
            onPasswordChange={(next) => {
              setNewPassword(next)
              revalidate(next, confirmPassword)
            }}
            onConfirmChange={(next) => {
              setConfirmPassword(next)
              revalidate(newPassword, next)
            }}
            passwordError={fieldErrors.newPassword}
            confirmError={fieldErrors.confirmPassword}
          />

          <Button
            variant="primary"
            label={submitting ? 'Saving…' : 'Set password'}
            type="submit"
            className={styles.submitButton}
          />
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
