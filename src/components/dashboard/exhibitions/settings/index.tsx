'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { HintText } from '@/components/ui/HintText'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { H1, P } from '@/components/ui/Typography'

import styles from './ExhibitionSettings.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  url: string
  userId: string
  status: string
  visibility: string
  startDate: string | null
  endDate: string | null
  user?: {
    handler: string
  }
}

interface ExhibitionSettingsPageProps {
  exhibitionId: string
}

export const ExhibitionSettingsPage = ({ exhibitionId }: ExhibitionSettingsPageProps) => {
  const { status: sessionStatus } = useSession()
  const router = useRouter()

  const [exhibition, setExhibition] = useState<Exhibition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Redirect if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/')
    }
  }, [sessionStatus, router])

  // Fetch exhibition data
  useEffect(() => {
    const fetchExhibition = async () => {
      try {
        const response = await fetch(`/api/exhibitions/${exhibitionId}`)
        if (!response.ok) {
          setError('Exhibition not found')
          return
        }
        const data = await response.json()
        setExhibition(data)
      } catch {
        setError('Failed to load exhibition')
      } finally {
        setLoading(false)
      }
    }

    if (exhibitionId) {
      fetchExhibition()
    }
  }, [exhibitionId])

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  if (error || !exhibition) {
    return (
      <div className={styles.page}>
        <ErrorText>{error || 'Exhibition not found'}</ErrorText>
        <Link href="/dashboard">← Back to Dashboard</Link>
      </div>
    )
  }

  const editUrl = exhibition.user?.handler
    ? `/exhibitions/${exhibition.user.handler}/${exhibition.url}/edit`
    : `/dashboard`

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href={editUrl} className={styles.backLink}>
          ← Back to Editor
        </Link>
      </div>

      <H1 className={styles.pageTitle}>Exhibition Settings</H1>
      <P className={styles.exhibitionName}>{exhibition.mainTitle}</P>

      <div className={styles.placeholder}>
        <P>Settings content coming soon...</P>
        <HintText>
          This page will include: title, description, dates, artists, and more.
        </HintText>
      </div>

      <div className={styles.actions}>
        <Button variant="small" label="Back to Editor" onClick={() => router.push(editUrl)} />
      </div>
    </div>
  )
}
