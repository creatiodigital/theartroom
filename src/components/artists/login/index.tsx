'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/Button'
<<<<<<< HEAD
import { ErrorText } from '@/components/ui/ErrorText'
import { Input } from '@/components/ui/Input'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { Text } from '@/components/ui/Typography'
=======
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H1 } from '@/components/ui/Typography'
>>>>>>> develop

import styles from './login.module.scss'

type Artist = {
  id: string
  name: string
  lastName: string
  handler: string
  email: string
}

interface ArtistLoginPageProps {
  handler: string
}

export const ArtistLoginPage = ({ handler }: ArtistLoginPageProps) => {
  const router = useRouter()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch artist info
  useEffect(() => {
    const fetchArtist = async () => {
      try {
        const response = await fetch(`/api/artists/${handler}`)
        if (!response.ok) {
          setNotFound(true)
          return
        }
        const data = await response.json()
        setArtist(data)
        if (data.email) {
          setEmail(data.email)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchArtist()
  }, [handler])

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

      // Get session to check user type
      const session = await getSession()

      if (session?.user?.userType === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError('Something went wrong')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loginPage}>
        <LoadingBar />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={styles.loginPage}>
<<<<<<< HEAD
        <Text as="h1">Artist Not Found</Text>
        <Text as="p">The artist you are looking for does not exist.</Text>
=======
        <H1>Artist Not Found</H1>
        <p>The artist you are looking for does not exist.</p>
>>>>>>> develop
      </div>
    )
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
<<<<<<< HEAD
        <Text as="h1">Welcome back, {artist?.name}</Text>
        <Text as="p" className={styles.subtitle}>
          Sign in to manage your exhibitions
        </Text>
=======
        <H1>Welcome back, {artist?.name}</H1>
        <p className={styles.subtitle}>Sign in to manage your exhibitions</p>
>>>>>>> develop

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
              required
            />
          </div>

          <ErrorText>{error}</ErrorText>

          <Button variant="small" label={submitting ? 'Signing in...' : 'Sign in'} type="submit" />
        </form>
      </div>
    </div>
  )
}
