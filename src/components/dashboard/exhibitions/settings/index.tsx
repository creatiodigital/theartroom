'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { LoadingBar } from '@/components/ui/LoadingBar'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'

import styles from './ExhibitionSettings.module.scss'

type Exhibition = {
  id: string
  mainTitle: string
  description: string | null
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
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

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
        setDescription(data.description || '')
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

  const handleSave = useCallback(async () => {
    if (!exhibition) return

    setSaving(true)
    setSaveSuccess(false)
    setError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [exhibition, description])

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className={styles.page}>
        <LoadingBar />
      </div>
    )
  }

  if (error && !exhibition) {
    return (
      <div className={styles.page}>
        <ErrorText>{error}</ErrorText>
        <Link href="/dashboard">← Back to Dashboard</Link>
      </div>
    )
  }

  if (!exhibition) {
    return (
      <div className={styles.page}>
        <ErrorText>Exhibition not found</ErrorText>
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

      <Text as="h1" className={styles.pageTitle}>
        {exhibition.mainTitle}
      </Text>

      <div className={styles.section}>
        <Text as="h3" font="sans" className={styles.sectionTitle}>
          Description
        </Text>
        <RichTextEditor
          content={description}
          onChange={setDescription}
          placeholder="Write a description for your exhibition..."
        />
      </div>

      <div className={styles.actions}>
        <Button
          size="small"
          label={saving ? 'Saving...' : 'Save Changes'}
          onClick={handleSave}
          disabled={saving}
        />
        {saveSuccess && (
          <Text as="span" className={styles.successMessage}>
            Saved!
          </Text>
        )}
      </div>

      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}
