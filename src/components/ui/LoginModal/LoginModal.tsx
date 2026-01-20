'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
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

  return (
    <div className={styles.loginModal}>
      <Text as="h2">Log in</Text>
      <form onSubmit={handleSubmit}>
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
            required
          />
        </div>
        <ErrorText>{error}</ErrorText>
        <div className={styles.actions}>
          <Button size="small" label={loading ? 'Logging in...' : 'Log in'} type="submit" />
          <Button size="small" label="Cancel" onClick={onClose} type="button" />
        </div>
      </form>
    </div>
  )
}
