'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'

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
    } else if (status === 'authenticated') {
      const userType = session?.user?.userType
      if (userType !== 'admin' && userType !== 'superAdmin') {
        router.push('/')
      }
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
    <DashboardLayout backLink="/admin/dashboard">
      <h1 className={dashboardStyles.pageTitle}>Edit: {slugLabels[slug] || slug}</h1>

      <div className={dashboardStyles.section}>
        <h3 className={dashboardStyles.sectionTitle}>Page Title</h3>
        <p className={dashboardStyles.sectionDescription}>
          The title displayed at the top of the page.
        </p>
        <Input
          id="title"
          size="medium"
          value={page.title}
          onChange={(e) => setPage({ ...page, title: e.target.value })}
        />
        <span className={dashboardStyles.hint}>This appears as the main heading.</span>
      </div>

      <div className={dashboardStyles.section}>
        <h3 className={dashboardStyles.sectionTitle}>Content</h3>
        <p className={dashboardStyles.sectionDescription}>
          The main body content of the page. Supports rich text formatting.
        </p>
        <RichTextEditor
          content={page.content}
          onChange={(content) => setPage({ ...page, content })}
          placeholder="Start writing your page content..."
        />
        <span className={dashboardStyles.hint}>Use the toolbar to format text, add headings, lists, and more.</span>
      </div>

      <div className={dashboardStyles.actions}>
        <Button
          font="dashboard"
          variant="primary"
          label={saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          onClick={handleSave}
        />
      </div>
    </DashboardLayout>
  )
}
