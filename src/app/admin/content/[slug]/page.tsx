'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { SaveBar } from '@/components/admin/ui/SaveBar'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { PAGE_ROUTE_BY_SLUG } from '@/lib/cms/pageRoutes'

import styles from './page.module.scss'

type PageContent = {
  id: string
  slug: string
  title: string
  content: string
  bannerImageUrl: string | null
  updatedAt: string
}

// The Content list's names (sentence case): "Content / About us", "About us page".
const slugLabels: Record<string, string> = {
  about: 'About us',
  prints: 'Prints',
  terms: 'Terms and conditions',
  privacy: 'Privacy policy',
  accessibility: 'Accessibility policy',
  'sale-terms': 'Online terms of sale',
}

// Pages that expose a top banner image in the editor + public view.
// Currently only the Prints page — other pages keep bannerImageUrl null.
const SLUGS_WITH_BANNER = new Set(['prints'])

// The public Prints page renders its text with RichText's default variant; About and
// the legal pages use `page` (StaticPageContent). The editor mirrors each.
const SLUGS_WITH_DEFAULT_TEXT = new Set(['prints'])

// What the title reaches on the public site (questions.md Q78): only the Prints
// banner's alt text; the other pages' headings are fixed in their components.
const TITLE_HELP_PRINTS = "Read by screen readers as the banner's description."
const TITLE_HELP_OTHERS = 'Not shown on the page, whose heading is fixed.'

// Q82: no page, no editor (an empty one could be saved over the live page).
const LOAD_FAILED = 'The page could not be loaded.'

// "9 Nov 2026, 18:20", as the dashboard's analytics footnote.
const formatLastSaved = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

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
  // questions.md Q82: Remove takes the banner off /prints at once, so it asks first.
  const [removeBannerOpen, setRemoveBannerOpen] = useState(false)
  // NEW (gallery.md §2c): what "unsaved" is measured against. `baseline` is the
  // last loaded or accepted values; `editorForm` is the editor's own HTML for the
  // baseline text (its sync rewrites the loaded HTML into that form on mount).
  const [baseline, setBaseline] = useState<{ title: string; content: string } | null>(null)
  const [editorForm, setEditorForm] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  // Q80: the values a refused save sent. The save bar says "Not saved" while the page still holds
  // exactly them: the next edit changes them (back to "Unsaved changes"), an accepted save clears it.
  const [failedSave, setFailedSave] = useState<{ title: string; content: string } | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

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
      // Q82: only a 2xx reply is the page. Anything else (a 401, a 500) leaves no
      // page, so the editor never opens on an error body.
      if (!response.ok) {
        setPage(null)
        setBaseline(null)
        return
      }
      const data = await response.json()
      setPage(data)
      // NEW: the baseline and Last saved.
      setBaseline({ title: data.title, content: data.content })
      setLastSaved(data.updatedAt ?? null)
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

    // NEW: the values this save sends; they become the baseline once accepted.
    const sent = { title: page.title, content: page.content }
    setSaving(true)
    setSaved(false)
    setFailedSave(null)
    try {
      const response = await fetch(`/api/pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: page.title, content: page.content }),
      })
      // NEW (questions.md Q80): only an accepted save counts, so the bar never
      // says "All changes saved" for a refused one.
      if (response.ok) {
        const row = await response.json().catch(() => null)
        setBaseline(sent)
        setEditorForm(sent.content)
        if (row?.updatedAt) setLastSaved(row.updatedAt)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setFailedSave(sent)
      }
    } catch (error) {
      console.error('Error saving page:', error)
      setFailedSave(sent)
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

  // NEW: unsaved = the title or the text differs from the baseline. The text
  // counts as unchanged in either form (as stored, or as the editor wrote it), and
  // only once the editor has reported its form. The banner saves on its own.
  const contentDirty =
    !!page &&
    !!baseline &&
    editorForm !== null &&
    page.content !== baseline.content &&
    page.content !== editorForm
  const dirty = !!page && !!baseline && (page.title !== baseline.title || contentDirty)
  const saveFailed =
    !!failedSave && !!page && page.title === failedSave.title && page.content === failedSave.content

  // Q81: with unsaved changes, reloading, closing the tab or typing a URL asks the
  // browser's own "Leave site?". In-app links (menu, breadcrumb) are not caught.
  useEffect(() => {
    if (!dirty) return
    const askFirst = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chrome asks only when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', askFirst)
    return () => window.removeEventListener('beforeunload', askFirst)
  }, [dirty])

  const label = slugLabels[slug] || slug
  const publicRoute = PAGE_ROUTE_BY_SLUG[slug]

  const breadcrumb = (
    <AdminBreadcrumb items={[{ label: 'Content', href: '/admin/content' }, { label }]} />
  )

  // The saved page, in a new tab. No link for a slug without a public route.
  const viewPage = publicRoute ? (
    <Link
      href={publicRoute}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      className={styles.view}
    >
      View page
      <ArrowSquareOut size={16} weight="light" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </Link>
  ) : undefined

  if (status === 'loading' || loading) {
    return (
      <div className={styles.page}>
        {breadcrumb}
        <AdminPageHeader title={`${label} page`} actions={viewPage} />
        <p className={styles.status}>Loading page…</p>
      </div>
    )
  }

  // Q82: a failed load (a non-2xx reply, or none): the header and View page stay;
  // no banner, title, editor or save bar.
  if (!page) {
    return (
      <div className={styles.page}>
        {breadcrumb}
        <AdminPageHeader title={`${label} page`} actions={viewPage} />
        <Callout tone="red" role="alert">
          {LOAD_FAILED}
        </Callout>
      </div>
    )
  }

  const showBanner = SLUGS_WITH_BANNER.has(slug)

  // NEW: Discard puts back the baseline (no request). The banner is left as it is.
  const confirmDiscard = () => {
    if (baseline) {
      setPage(
        (prev) =>
          prev && {
            ...prev,
            title: baseline.title,
            content: contentDirty ? baseline.content : prev.content,
          },
      )
    }
    setDiscardOpen(false)
  }

  return (
    <div className={styles.page}>
      {breadcrumb}
      <AdminPageHeader
        title={`${label} page`}
        description={lastSaved ? `Last saved ${formatLastSaved(lastSaved)}` : undefined}
        actions={viewPage}
      />

      {showBanner && (
        <section aria-labelledby="banner-label" className={c(styles.panel, styles.bannerPanel)}>
          <div className={styles.panelHead}>
            <h2 id="banner-label" className={styles.label}>
              Banner image
            </h2>
            <p className={styles.sub}>
              A wide image at the top of the Prints page, as prominent as the homepage hero.
            </p>
          </div>
          <ImageUploader
            tone="admin"
            imageUrl={page.bannerImageUrl}
            onUpload={handleBannerUpload}
            onRemove={() => setRemoveBannerOpen(true)}
            uploading={uploadingBanner}
            loadingText="Uploading…"
            error={bannerError}
            aspectRatio="16 / 9"
            note={
              <>
                <span>JPG or PNG, up to 1 MB.</span>
                <span>Saved as soon as it uploads or is removed.</span>
              </>
            }
          />
        </section>
      )}

      <section aria-labelledby="title-label" className={styles.panel}>
        <label id="title-label" htmlFor="title" className={styles.label}>
          Page title
        </label>
        <Input
          id="title"
          size="bare"
          inputClassName={styles.input}
          aria-describedby="title-help"
          value={page.title}
          onChange={(e) => setPage({ ...page, title: e.target.value })}
        />
        <p id="title-help" className={styles.help}>
          {showBanner ? TITLE_HELP_PRINTS : TITLE_HELP_OTHERS}
        </p>
      </section>

      <section aria-labelledby="content-label" className={styles.panel}>
        <span id="content-label" className={styles.label}>
          Content
        </span>
        <RichTextEditor
          tone="admin"
          richTextVariant={SLUGS_WITH_DEFAULT_TEXT.has(slug) ? 'default' : 'page'}
          labelledBy="content-label"
          describedBy="content-help"
          onReady={setEditorForm}
          content={page.content}
          onChange={(content) => setPage({ ...page, content })}
          placeholder="Start writing your page content…"
        />
        <p id="content-help" className={styles.help}>
          Headings, lists, quotes and links are available in the toolbar.
        </p>
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        failed={saveFailed}
        onSave={handleSave}
        onDiscard={() => setDiscardOpen(true)}
      />

      {removeBannerOpen && (
        <AdminConfirmModal
          title="Remove the banner?"
          message="It comes off the Prints page at once."
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            setRemoveBannerOpen(false)
            void handleBannerRemove()
          }}
          onCancel={() => setRemoveBannerOpen(false)}
        />
      )}

      {discardOpen && (
        <AdminConfirmModal
          title="Discard changes?"
          message="Your changes since the last save will be lost."
          confirmLabel="Discard"
          destructive
          onConfirm={confirmDiscard}
          onCancel={() => setDiscardOpen(false)}
        />
      )}
    </div>
  )
}
