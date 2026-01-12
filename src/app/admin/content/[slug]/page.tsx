'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'

import styles from './page.module.scss'

type PageContent = {
  id: string
  slug: string
  title: string
  content: string
}

const slugLabels: Record<string, string> = {
  about: 'About Us',
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  accessibility: 'Accessibility Policy',
}

type PageProps = {
  params: Promise<{ slug: string }>
}

export default function PageContentEditor({ params }: PageProps) {
  const { slug } = use(params)
  const router = useRouter()
  const { data: session, status } = useSession()

  const [page, setPage] = useState<PageContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    } else if (status === 'authenticated' && session?.user?.userType !== 'admin') {
      router.push('/')
    }
  }, [status, session, router])

  const fetchPage = useCallback(async () => {
    try {
      const response = await fetch(`/api/pages/${slug}`)
      const data = await response.json()
      setPage(data)
    } catch (error) {
      console.error('Error fetching page:', error)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchPage()
  }, [fetchPage])

  const handleSave = async () => {
    if (!page) return

    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: page.title, content: page.content }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving page:', error)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return <div className={styles.page}>Loading...</div>
  }

  if (!page) {
    return <div className={styles.page}>Page not found</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Text font="dashboard" as="h1">Edit: {slugLabels[slug] || slug}</Text>
        <Button font="dashboard" variant="secondary" label="← Back to Dashboard" onClick={() => router.push('/admin')} />
      </div>

      <div className={styles.field}>
        <Text font="dashboard" as="label">Page Title</Text>
        <Input
          id="title"
          value={page.title}
          onChange={(e) => setPage({ ...page, title: e.target.value })}
        />
      </div>

      <div className={styles.field}>
        <Text font="dashboard" as="label">Content</Text>
        <RichTextEditor
          content={page.content}
          onChange={(content) => setPage({ ...page, content })}
          placeholder="Start writing your page content..."
        />
      </div>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          label={saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          onClick={handleSave}
        />
      </div>
    </div>
  )
}
