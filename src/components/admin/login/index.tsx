'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ForgotPasswordModal } from '@/components/ui/ForgotPasswordModal'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './login.module.scss'

export const AdminLoginPage = () => {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  
  // 2FA step: 'credentials' or 'code'
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/send-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid email or password')
        setSubmitting(false)
        return
      }

      // Move to code verification step
      setStep('code')
      setSubmitting(false)
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        loginCode,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid or expired verification code')
        setSubmitting(false)
        return
      }

      // Get session to verify admin or superAdmin
      const session = await getSession()

      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        setError('Access denied. Admin only.')
        setSubmitting(false)
        return
      }

      router.push('/admin/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/auth/send-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        setError('')
        setLoginCode('')
      } else {
        setError('Failed to resend code')
      }
    } catch {
      setError('Failed to resend code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <Text font="dashboard" as="h1">Admin Login</Text>
          <Text font="dashboard" as="p" className={styles.subtitle}>
            The Art Room Administration
          </Text>

          {step === 'credentials' ? (
            <form onSubmit={handleSendCode} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <Input
                  id="email"
                  type="email"
                  size="medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <Input
                  id="password"
                  type="password"
                  size="medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  showPasswordToggle
                  required
                />
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </button>
              </div>

              <ErrorText>{error}</ErrorText>

              <Button font="dashboard" variant="primary" label={submitting ? 'Sending code...' : 'Continue'} type="submit" />
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className={styles.form}>
              <Text font="dashboard" as="p" className={styles.codeMessage}>
                We sent a verification code to <strong>{email}</strong>
              </Text>

              <div className={styles.field}>
                <label htmlFor="loginCode">Verification Code</label>
                <Input
                  id="loginCode"
                  type="text"
                  size="medium"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>

              <ErrorText>{error}</ErrorText>

              <div className={styles.codeActions}>
                <Button font="dashboard" variant="primary" label={submitting ? 'Verifying...' : 'Sign in'} type="submit" />
                <button
                  type="button"
                  className={styles.resendLink}
                  onClick={handleResendCode}
                  disabled={submitting}
                >
                  Resend code
                </button>
              </div>

              <button
                type="button"
                className={styles.backLink}
                onClick={() => { setStep('credentials'); setLoginCode(''); setError(''); }}
              >
                ← Back to login
              </button>
            </form>
          )}
        </div>
      </div>

      {showForgotPassword && (
        <Modal onClose={() => setShowForgotPassword(false)}>
          <ForgotPasswordModal
            onClose={() => setShowForgotPassword(false)}
            onBack={() => setShowForgotPassword(false)}
          />
        </Modal>
      )}
    </>
  )
}
