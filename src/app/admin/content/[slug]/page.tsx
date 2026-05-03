'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { ImageUploader } from '@/components/ui/ImageUploader'
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
  bannerImageUrl: string | null
}

const slugLabels: Record<string, string> = {
  about: 'About Us',
  prints: 'Prints',
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  accessibility: 'Accessibility Policy',
  'sale-terms': 'Online Terms of Sale',
}

// Pages that expose a top banner image in the editor + public view.
// Currently only the Prints page — other pages keep bannerImageUrl null.
const SLUGS_WITH_BANNER = new Set(['prints'])

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
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerError, setBannerError] = useState('')

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

  const handleBannerUpload = useCallback(
    async (file: File) => {
      setUploadingBanner(true)
      setBannerError('')
      try {
        const body = new FormData()
        body.append('image', file)
        const response = await fetch(`/api/pages/${slug}/image`, { method: 'POST', body })
        const data = await response.json()
        if (!response.ok) {
          setBannerError(data.error || 'Failed to upload banner')
          return
        }
        setPage((prev) => (prev ? { ...prev, bannerImageUrl: data.url } : prev))
      } catch {
        setBannerError('Failed to upload banner')
      } finally {
        setUploadingBanner(false)
      }
    },
    [slug],
  )

  const handleBannerRemove = useCallback(async () => {
    if (!page?.bannerImageUrl) return
    setUploadingBanner(true)
    setBannerError('')
    try {
      const response = await fetch(`/api/pages/${slug}/image`, { method: 'DELETE' })
      if (!response.ok) {
        setBannerError('Failed to remove banner')
        return
      }
      setPage((prev) => (prev ? { ...prev, bannerImageUrl: null } : prev))
    } catch {
      setBannerError('Failed to remove banner')
    } finally {
      setUploadingBanner(false)
    }
  }, [slug, page?.bannerImageUrl])

  if (status === 'loading' || loading) {
    return <div className={styles.page}>Loading...</div>
  }

  if (!page) {
    return <div className={styles.page}>Page not found</div>
  }

  const showBanner = SLUGS_WITH_BANNER.has(slug)

  return (
    <DashboardLayout backLink="/admin/dashboard">
      <h1 className={dashboardStyles.pageTitle}>Edit: {slugLabels[slug] || slug}</h1>

      {showBanner && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Banner Image</h3>
          <p className={dashboardStyles.sectionDescription}>
            A wide image shown at the top of the Prints page — same prominence as the landing page
            hero.
          </p>
          <ImageUploader
            imageUrl={page.bannerImageUrl}
            onUpload={handleBannerUpload}
            onRemove={handleBannerRemove}
            uploading={uploadingBanner}
            error={bannerError}
            aspectRatio="16 / 9"
          />
          <span className={dashboardStyles.hint}>Recommended: JPG, PNG, or WebP. Max 1MB.</span>
        </div>
      )}

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
        <span className={dashboardStyles.hint}>
          Use the toolbar to format text, add headings, lists, and more.
        </span>
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
