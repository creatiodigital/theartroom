'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowSquareOut, Cube, PencilSimple } from '@phosphor-icons/react'
import c from 'classnames'

import { slugify } from '@/utils/slugify'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { PublishState } from '@/components/admin/ui/PublishState'
import { SaveBar } from '@/components/admin/ui/SaveBar'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

import { StudioPanel } from '../../StudioPanel'
import page from '../../StudioPanel/studioPage.module.scss'
import styles from './ExhibitionSettings.module.scss'
import { LanguagesPanel } from './LanguagesPanel'
import { SectionsEditor } from './SectionsEditor'

type Exhibition = {
  id: string
  mainTitle: string
  description: string | null
  shortDescription: string | null
  featuredImageUrl: string | null
  url: string
  userId: string
  status: string

  startDate: string | null
  endDate: string | null
  user?: {
    handler: string
  }
  // Display only (the header's dot and badge); the GET returns the whole record.
  published?: boolean
  hasPendingChanges?: boolean
  // AR-182: the Languages card's starting state (it saves on its own).
  secondLanguage?: string | null
  secondLanguageVisible?: boolean
}

interface ExhibitionSettingsPageProps {
  exhibitionId: string
}

/** What a refused text save sent, to compare with what the fields hold now. */
const textsKey = (shortDescription: string, description: string) =>
  JSON.stringify([shortDescription, description])

/** The counter turns amber from here (artist.md §6); typing stops at 400. */
const SHORT_DESCRIPTION_NEAR = 360

export const ExhibitionSettingsPage = ({ exhibitionId }: ExhibitionSettingsPageProps) => {
  const [exhibition, setExhibition] = useState<Exhibition | null>(null)
  const [mainTitle, setMainTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shortDescription, setShortDescription] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [urlError, setUrlError] = useState('')
  // questions.md Q128 (e): name and image failures show where they happened (one `error` at the end
  // of the page held them all); the end-of-page error is the text save's, next to its bar.
  const [nameError, setNameError] = useState('')
  const [imageError, setImageError] = useState('')
  // Q128 (d): Remove takes effect at once, so it asks first.
  const [confirmingRemoveImage, setConfirmingRemoveImage] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // The save bar's state (display only: nothing here is sent). It covers the two
  // texts the page's Save sends; the name, the image and the sections save on
  // their own (questions.md Q119). The editor's own rewrite of the loaded
  // description (reported once through onReady) is not a change.
  const [baseline, setBaseline] = useState<{
    shortDescription: string
    description: string
  } | null>(null)
  const [editorDescription, setEditorDescription] = useState<string | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  // An accepted name or text save on a published exhibition leaves it with
  // pending changes (the PUT's own rule): the header's badge follows.
  const [savedEdits, setSavedEdits] = useState(false)

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
        setMainTitle(data.mainTitle || '')
        setCustomUrl(data.url || '')
        setDescription(data.description || '')
        setShortDescription(data.shortDescription || '')
        setBaseline({
          shortDescription: data.shortDescription || '',
          description: data.description || '',
        })
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

  const handleSaveName = useCallback(async () => {
    if (!exhibition || !mainTitle.trim()) return

    const newUrl = customUrl.trim() ? slugify(customUrl) : slugify(mainTitle)
    // Skip check if URL hasn't changed
    if (newUrl !== exhibition.url) {
      // Check uniqueness
      setSavingName(true)
      try {
        const checkResponse = await fetch(
          `/api/exhibitions/check-url?userId=${exhibition.userId}&url=${encodeURIComponent(newUrl)}&excludeId=${exhibition.id}`,
        )
        const checkData = await checkResponse.json().catch(() => null)
        // Q128 (e): only an answered "taken" stops here. A refused or unreadable check read as
        // "taken"; now it, like a failed one, goes on to the save, whose 409 says it.
        if (checkResponse.ok && checkData?.available === false) {
          setUrlError('An exhibition with this name already exists.')
          setSavingName(false)
          return
        }
      } catch {
        // Continue — server-side will catch it
      }
    }

    setSavingName(true)
    setUrlError('')
    setNameError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainTitle, url: customUrl.trim() || undefined }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 409) {
          setUrlError(data.error || 'An exhibition with this name already exists.')
        } else {
          setNameError(data.error || 'Failed to save name')
        }
        return
      }

      // Update local exhibition state with new name/url
      const finalUrl = customUrl.trim() ? slugify(customUrl) : slugify(mainTitle)
      setExhibition((prev) => (prev ? { ...prev, mainTitle, url: finalUrl } : prev))
      setCustomUrl(finalUrl)
      setEditingName(false)
      setSaveSuccess(true)
      setSavedEdits(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setNameError('Failed to save name')
    } finally {
      setSavingName(false)
    }
  }, [exhibition, mainTitle, customUrl])

  const handleCancelEditName = useCallback(() => {
    setMainTitle(exhibition?.mainTitle || '')
    setCustomUrl(exhibition?.url || '')
    setUrlError('')
    setNameError('')
    setEditingName(false)
  }, [exhibition])

  const handleSave = useCallback(async () => {
    if (!exhibition) return

    setSaving(true)
    setSaveSuccess(false)
    setError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, shortDescription }),
      })

      if (!response.ok) {
        setFailedKey(textsKey(shortDescription, description))
        const data = await response.json()
        setError(data.error || 'Failed to save')
        return
      }

      setSaveSuccess(true)
      setBaseline({ shortDescription, description })
      setFailedKey(null)
      setSavedEdits(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setError('Failed to save changes')
      setFailedKey(textsKey(shortDescription, description))
    } finally {
      setSaving(false)
    }
  }, [exhibition, description, shortDescription])

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!exhibition) return

      setUploading(true)
      setImageError('')

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/exhibitions/${exhibition.id}/image`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          setImageError(data.error || 'Failed to upload image')
          setUploading(false)
          return
        }

        const data = await response.json()
        setExhibition((prev) => (prev ? { ...prev, featuredImageUrl: data.url } : prev))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch {
        setImageError('Failed to upload image')
      } finally {
        setUploading(false)
      }
    },
    [exhibition],
  )

  const handleRemoveImage = useCallback(async () => {
    if (!exhibition?.featuredImageUrl) return

    setUploading(true)
    setImageError('')

    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}/image`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setImageError('Failed to remove image')
        setUploading(false)
        return
      }

      setExhibition((prev) => (prev ? { ...prev, featuredImageUrl: null } : prev))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setImageError('Failed to remove image')
    } finally {
      setUploading(false)
    }
  }, [exhibition])

  const onDescriptionReady = useCallback((html: string) => setEditorDescription(html), [])

  const descriptionChanged =
    baseline !== null &&
    editorDescription !== null &&
    description !== baseline.description &&
    description !== editorDescription
  const dirty =
    baseline !== null && (shortDescription !== baseline.shortDescription || descriptionChanged)
  const failed = failedKey !== null && failedKey === textsKey(shortDescription, description)
  // An open name edit holding a name or URL other than the saved ones.
  const nameUnsaved =
    editingName &&
    !!exhibition &&
    (mainTitle !== exhibition.mainTitle || customUrl !== exhibition.url)

  // Discard (asked first) puts back the last loaded or saved texts, with no
  // request. The name, the image and the sections are left as they are.
  const confirmDiscard = () => {
    if (baseline) {
      setShortDescription(baseline.shortDescription)
      setDescription(baseline.description)
    }
    setFailedKey(null)
    setConfirmingDiscard(false)
  }

  // Reloading, closing the tab or typing a URL with unsaved texts, or with an
  // open name edit that changed something, asks the browser's own "Leave site?"
  // (as the page editor, Q81 / Q118). In-app links are not caught.
  const leaveWarning = dirty || nameUnsaved
  useEffect(() => {
    if (!leaveWarning) return
    const askFirst = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chrome asks only when returnValue is set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', askFirst)
    return () => window.removeEventListener('beforeunload', askFirst)
  }, [leaveWarning])

  const breadcrumb = (name: string) => (
    <AdminBreadcrumb items={[{ label: 'My exhibitions', href: '/dashboard' }, { label: name }]} />
  )

  if (loading) {
    return (
      <div className={page.page}>
        {breadcrumb('Exhibition')}
        <p className={page.status}>Loading exhibition…</p>
      </div>
    )
  }

  if (error && !exhibition) {
    return (
      <div className={page.page}>
        {breadcrumb('Exhibition')}
        <Callout tone="red" role="alert">
          {error}
        </Callout>
      </div>
    )
  }

  if (!exhibition) {
    return (
      <div className={page.page}>
        {breadcrumb('Exhibition')}
        <Callout tone="red" role="alert">
          Exhibition not found
        </Callout>
      </div>
    )
  }

  // The record's handler (the session's can be stale after a profile URL change).
  const handler = exhibition.user?.handler
  const published = !!exhibition.published
  const shortLength = shortDescription.length

  return (
    <div className={c(page.page, page.withSaveBar, styles.page)}>
      {breadcrumb(exhibition.mainTitle)}

      <AdminPageHeader
        title="Exhibition settings"
        description={
          <span className={styles.state}>
            <PublishState published={published} />
            {/* As on Home: the sync badge on published exhibitions only. */}
            {published &&
              (exhibition.hasPendingChanges || savedEdits ? (
                <StatusPill label="Pending changes" tone="amber" shape="tag" />
              ) : (
                <StatusPill label="Up to date" tone="green" shape="tag" />
              ))}
          </span>
        }
        actions={
          handler ? (
            <>
              {/* Unpublished, the public page doesn't exist yet (Home disables it too). */}
              {published && (
                <Link
                  href={`/exhibitions/${handler}/${exhibition.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  prefetch={false}
                  className={page.outline}
                >
                  View exhibition
                  <ArrowSquareOut size={14} weight="light" aria-hidden />
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
              )}
              <Link
                href={`/exhibitions/${handler}/${exhibition.url}/edit`}
                prefetch={false}
                className={page.outline}
              >
                <Cube size={16} weight="light" aria-hidden />
                Edit 3D space
              </Link>
            </>
          ) : undefined
        }
      />

      <StudioPanel
        title="Name and address"
        description="The name of your exhibition. This also determines the URL slug."
        className={styles.namePanel}
      >
        <div className={page.field}>
          <label htmlFor="exhibition-name" className={page.label}>
            Exhibition name
          </label>
          <div className={styles.nameRow}>
            <Input
              id="exhibition-name"
              type="text"
              size="bare"
              className={styles.nameField}
              inputClassName={page.input}
              value={mainTitle}
              onChange={(e) => setMainTitle(e.target.value)}
              placeholder="Exhibition name"
              readOnly={!editingName}
              invalid={!!urlError}
              aria-label="Exhibition name"
            />
            {!editingName && (
              <Button
                variant="bare"
                font="dashboard"
                className={c(page.outline, styles.editName)}
                onClick={() => setEditingName(true)}
              >
                <PencilSimple size={16} weight="light" aria-hidden />
                Edit name
              </Button>
            )}
          </div>
        </div>

        <div className={page.field}>
          <label htmlFor="exhibition-url" className={page.label}>
            Exhibition URL
          </label>
          <div className={page.prefixBox}>
            <span id="exhibition-url-prefix" className={page.prefix}>
              …/{exhibition.user?.handler || 'artist'}/
            </span>
            <Input
              id="exhibition-url"
              type="text"
              size="bare"
              className={page.prefixField}
              inputClassName={page.prefixInput}
              value={customUrl}
              onChange={(e) =>
                setCustomUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              placeholder={slugify(mainTitle)}
              readOnly={!editingName}
              invalid={!!urlError}
              aria-describedby={
                editingName ? 'exhibition-url-prefix exhibition-url-help' : 'exhibition-url-prefix'
              }
            />
          </div>
          {urlError && <ErrorText className={page.fieldError}>{urlError}</ErrorText>}
          {nameError && <ErrorText className={page.fieldError}>{nameError}</ErrorText>}
          {editingName && (
            <p id="exhibition-url-help" className={page.help}>
              Leave empty to auto-generate from title. Only lowercase letters, numbers, and dashes.
            </p>
          )}
        </div>

        {editingName && (
          <div className={styles.nameActions}>
            <Button
              variant="bare"
              font="dashboard"
              className={page.primary}
              onClick={handleSaveName}
              disabled={savingName || !mainTitle.trim()}
            >
              {savingName ? 'Saving…' : 'Save name'}
            </Button>
            <Button
              variant="bare"
              font="dashboard"
              className={page.outline}
              onClick={handleCancelEditName}
              disabled={savingName}
            >
              Cancel
            </Button>
          </div>
        )}
      </StudioPanel>

      <StudioPanel
        title="Featured image"
        description="The main image for your exhibition. This will be displayed on exhibition listings and as a cover."
      >
        <ImageUploader
          tone="admin"
          imageUrl={exhibition.featuredImageUrl}
          onUpload={handleImageUpload}
          onRemove={() => setConfirmingRemoveImage(true)}
          uploading={uploading}
          error={imageError || undefined}
          aspectRatio="16 / 9"
          note={
            <>
              <span>Recommended: JPG, PNG, or WebP. Max 1MB.</span>
              <span>Saved as soon as it uploads or is removed.</span>
            </>
          }
        />
      </StudioPanel>

      <StudioPanel
        id="exhibition-short"
        title="Short description"
        aside={
          <span
            aria-live="polite"
            className={c(
              styles.counter,
              shortLength >= SHORT_DESCRIPTION_NEAR && styles.counterNear,
            )}
          >
            {shortLength} / 400
            <span className="sr-only"> characters</span>
          </span>
        }
      >
        <textarea
          value={shortDescription}
          onChange={(e) => {
            if (e.target.value.length <= 400) setShortDescription(e.target.value)
          }}
          placeholder="Write a short description…"
          className={page.textarea}
          rows={3}
          maxLength={400}
          aria-labelledby="exhibition-short-title"
          aria-describedby="exhibition-short-help"
        />
        <p id="exhibition-short-help" className={page.help}>
          A brief summary shown on exhibition listings. Max 400 characters.
        </p>
      </StudioPanel>

      {/* AR-182: saves on its own, at once (as the name, the image and the sections). */}
      <LanguagesPanel
        exhibitionId={exhibition.id}
        initial={{
          secondLanguage: exhibition.secondLanguage ?? null,
          secondLanguageVisible: exhibition.secondLanguageVisible ?? false,
        }}
        roomHref={handler ? `/exhibitions/${handler}/${exhibition.url}/visit` : null}
      />

      <SectionsEditor exhibitionId={exhibition.id} />

      <StudioPanel
        id="exhibition-description"
        title="Description"
        description="Tell visitors about this exhibition. Supports rich text formatting."
      >
        <RichTextEditor
          tone="admin"
          labelledBy="exhibition-description-title"
          describedBy="exhibition-description-description exhibition-description-help"
          content={description}
          onChange={setDescription}
          onReady={onDescriptionReady}
          placeholder="Write a description for your exhibition…"
        />
        <p id="exhibition-description-help" className={page.help}>
          A compelling description helps attract visitors to your exhibition.
        </p>
      </StudioPanel>

      {error && (
        <Callout tone="red" role="alert">
          {error}
        </Callout>
      )}

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saveSuccess}
        failed={failed}
        cleanMessage={editingName ? "The new name isn't saved yet: use Save name." : undefined}
        // Today's Save was disabled while saving; the bar's never is, so a second
        // press does nothing until the first save is answered.
        onSave={() => {
          if (!saving) void handleSave()
        }}
        onDiscard={() => setConfirmingDiscard(true)}
      />

      {confirmingRemoveImage && (
        <AdminConfirmModal
          title="Remove the featured image?"
          message="This takes effect at once."
          confirmLabel="Remove"
          destructive
          onConfirm={() => {
            setConfirmingRemoveImage(false)
            void handleRemoveImage()
          }}
          onCancel={() => setConfirmingRemoveImage(false)}
        />
      )}

      {confirmingDiscard && (
        <AdminConfirmModal
          title="Discard changes?"
          message="Your changes since the last save will be lost."
          confirmLabel="Discard"
          destructive
          onConfirm={confirmDiscard}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}
    </div>
  )
}
