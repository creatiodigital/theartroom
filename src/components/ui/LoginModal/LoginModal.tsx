'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ForgotPasswordModal } from '@/components/ui/ForgotPasswordModal'
import { Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'

import styles from './LoginModal.module.scss'

type LoginModalProps = {
  onClose: () => void
}

export const LoginModal = ({ onClose }: LoginModalProps) => {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  
  // 2FA step: 'credentials' or 'code'
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/send-login-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid email or password')
        setLoading(false)
        return
      }

      // Move to code verification step
      setStep('code')
      setLoading(false)
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        loginCode,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid or expired verification code')
        setLoading(false)
        return
      }

      // Get the updated session to check user type
      const session = await getSession()
      onClose()

      // Redirect based on user type
      const userType = session?.user?.userType
      if (userType === 'admin' || userType === 'superAdmin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setLoading(true)

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
      setLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <ForgotPasswordModal
        onClose={onClose}
        onBack={() => setShowForgotPassword(false)}
      />
    )
  }

  return (
    <div className={styles.loginModal}>
      <Text as="h2">Log in</Text>
      
      {step === 'credentials' ? (
        <form onSubmit={handleSendCode}>
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
          <div className={styles.actions}>
            <Button size="small" label={loading ? 'Sending code...' : 'Continue'} type="submit" />
            <Button size="small" label="Cancel" onClick={onClose} type="button" />
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <Text as="p" className={styles.codeMessage}>
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
          <div className={styles.actions}>
            <Button size="small" label={loading ? 'Verifying...' : 'Log in'} type="submit" />
            <button
              type="button"
              className={styles.resendLink}
              onClick={handleResendCode}
              disabled={loading}
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
  )
}
