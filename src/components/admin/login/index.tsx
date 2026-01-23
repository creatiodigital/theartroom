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
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
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

  return (
    <>
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <Text font="dashboard" as="h1">Admin Login</Text>
          <Text font="dashboard" as="p" className={styles.subtitle}>
            The Art Room Administration
          </Text>

          <form onSubmit={handleSubmit} className={styles.form}>
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

            <Button font="dashboard" variant="primary" label={submitting ? 'Signing in...' : 'Sign in'} type="submit" />
          </form>
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

