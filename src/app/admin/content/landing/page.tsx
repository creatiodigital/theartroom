'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { ArrowSquareOut, PencilSimple, Plus, Trash } from '@phosphor-icons/react'

import { AdminBreadcrumb } from '@/components/admin/ui/AdminBreadcrumb'
import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { AdminPageHeader } from '@/components/admin/ui/AdminPageHeader'
import { Callout } from '@/components/admin/ui/Callout'
import { EmptyState } from '@/components/admin/ui/EmptyState'
import { FeedbackBar } from '@/components/admin/ui/FeedbackBar'
import { ListPanel } from '@/components/admin/ui/ListPanel'
import { SORTABLE_KEYBOARD_HINT, SortableList } from '@/components/admin/ui/SortableList'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './page.module.scss'

type Slide = {
  id: string
  order: number
  imageUrl: string
  mobileImageUrl: string | null
  title: string
  subtitle: string
  meta: string
  exhibitionUrl: string
  isActive: boolean
  textColor: string
  ctaBackgroundColor: string
  ctaTextColor: string
}

// `desktop` is the main image; `mobile` is the optional portrait one used on
// phones and tablets (falls back to the desktop image when absent).
type SlideImageVariant = 'desktop' | 'mobile'

const IMAGE_FIELD = {
  desktop: 'imageUrl',
  mobile: 'mobileImageUrl',
} as const satisfies Record<SlideImageVariant, keyof Slide>

const slideImageEndpoint = (slideId: string, variant: SlideImageVariant) =>
  `/api/slides/${slideId}/image${variant === 'mobile' ? '?variant=mobile' : ''}`

/** A slide's name in the list, the handle and the delete dialog (questions.md Q71). */
const slideTitle = (slide: Slide) => slide.title.trim() || 'Untitled'

const slidesCount = (n: number) => (n === 1 ? '1 slide' : `${n} slides`)

const TITLE = 'Homepage slideshow'
const DESCRIPTION = 'The slides at the top of the homepage, in this order. Drag to reorder.'

export default function LandingContentPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [isNewSlide, setIsNewSlide] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<SlideImageVariant | null>(null)
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<SlideImageVariant, string>>>({})
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null)
  // questions.md Q74: a failed list load, a refused Save (in its dialog, as the save bar says it) and
  // a refused delete or reorder (a red bar) are said on screen; they used to be console only.
  const [loadError, setLoadError] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [actionError, setActionError] = useState('')

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

  const fetchSlides = useCallback(async () => {
    try {
      const response = await fetch('/api/slides')
      const data = await response.json().catch(() => null)
      // Q74: a refused or malformed reply is no list of slides (it used to become one, and the
      // page crashed on `slides.map`).
      if (!response.ok || !Array.isArray(data)) throw new Error(`Slides: ${response.status}`)
      setSlides(data)
      setLoadError(false)
    } catch (error) {
      console.error('Error fetching slides:', error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSlides()
  }, [fetchSlides])

  const handleAddSlide = () => {
    setEditingSlide({
      id: '',
      order: slides.length,
      imageUrl: '',
      mobileImageUrl: null,
      title: '',
      subtitle: '',
      meta: '',
      exhibitionUrl: '',
      isActive: true,
      textColor: '#ffffff',
      ctaBackgroundColor: '#ffffff',
      ctaTextColor: '#000000',
    })
    setIsNewSlide(true)
    setUploadErrors({})
    setSaveFailed(false)
  }

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide)
    setIsNewSlide(false)
    setUploadErrors({})
    setSaveFailed(false)
  }

  const setUploadError = (variant: SlideImageVariant, message: string | null) =>
    setUploadErrors((prev) => ({ ...prev, [variant]: message ?? undefined }))

  const uploadImageToSlide = useCallback(
    async (file: File, slideId: string, variant: SlideImageVariant) => {
      setUploading(variant)
      setUploadError(variant, null)
      try {
        const formData = new FormData()
        formData.append('image', file)
        const response = await fetch(slideImageEndpoint(slideId, variant), {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok) {
          setUploadError(variant, data.error || 'Failed to upload image')
          return
        }
        setEditingSlide((prev) => (prev ? { ...prev, [IMAGE_FIELD[variant]]: data.url } : null))
      } catch (error) {
        console.error('Error uploading image:', error)
        setUploadError(variant, 'Failed to upload image')
      } finally {
        setUploading(null)
      }
    },
    [],
  )

  // ImageUploader's onUpload. For a brand-new slide we need a DB row to
  // attach the R2 image to, so create the slide first (empty fields are
  // fine — the user fills them in via the form and clicks Save).
  const handleSlideUpload = useCallback(
    async (file: File, variant: SlideImageVariant) => {
      if (!editingSlide) return
      if (isNewSlide && !editingSlide.id) {
        setSaving(true)
        setUploadError(variant, null)
        try {
          // Q74: created hidden, so an image alone never puts an unsaved slide on the homepage;
          // Save shows it (below). Closed without Save, it stays in the list, marked, off the homepage.
          const response = await fetch('/api/slides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...editingSlide, isActive: false }),
          })
          const savedSlide = await response.json()
          if (!response.ok) {
            setUploadError(variant, savedSlide.error || 'Failed to create slide')
            return
          }
          setEditingSlide(savedSlide)
          setIsNewSlide(false)
          await uploadImageToSlide(file, savedSlide.id, variant)
          await fetchSlides()
        } catch (error) {
          console.error('Error creating slide:', error)
          setUploadError(variant, 'Failed to create slide')
        } finally {
          setSaving(false)
        }
      } else {
        await uploadImageToSlide(file, editingSlide.id, variant)
      }
    },
    [editingSlide, isNewSlide, uploadImageToSlide, fetchSlides],
  )

  const handleSlideImageRemove = useCallback(
    async (variant: SlideImageVariant) => {
      if (!editingSlide?.id || !editingSlide[IMAGE_FIELD[variant]]) return
      setUploading(variant)
      setUploadError(variant, null)
      try {
        const response = await fetch(slideImageEndpoint(editingSlide.id, variant), {
          method: 'DELETE',
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          setUploadError(variant, data.error || 'Failed to remove image')
          return
        }
        setEditingSlide((prev) =>
          prev ? { ...prev, [IMAGE_FIELD[variant]]: variant === 'mobile' ? null : '' } : null,
        )
      } catch (error) {
        console.error('Error removing image:', error)
        setUploadError(variant, 'Failed to remove image')
      } finally {
        setUploading(null)
      }
    },
    [editingSlide],
  )

  const handleSaveSlide = async () => {
    if (!editingSlide) return

    setSaving(true)
    setSaveFailed(false)
    try {
      const url = isNewSlide ? '/api/slides' : `/api/slides/${editingSlide.id}`
      const method = isNewSlide ? 'POST' : 'PUT'

      // Q74: Save is what puts a slide on the homepage, one first created by an image upload
      // (hidden until now) included. This screen has no way to hide a slide.
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingSlide, isActive: true }),
      })
      // Q74: a refused save keeps the dialog open and says so (it used to close as if saved).
      if (!response.ok) {
        setSaveFailed(true)
        return
      }

      await fetchSlides()
      setEditingSlide(null)
    } catch (error) {
      console.error('Error saving slide:', error)
      setSaveFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSlide = async () => {
    if (!deleteTarget) return
    const target = deleteTarget

    try {
      const response = await fetch(`/api/slides/${target.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Delete: ${response.status}`)
    } catch (error) {
      // Q74: said on screen, not only in the console.
      console.error('Error deleting slide:', error)
      setActionError(`Couldn't delete ${slideTitle(target)}. Please try again.`)
    }
    setDeleteTarget(null)
    await fetchSlides()
  }

  const updateField = (field: keyof Slide, value: string | number | boolean) => {
    if (!editingSlide) return
    setEditingSlide({ ...editingSlide, [field]: value })
    setSaveFailed(false)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)
      const newSlides = arrayMove(slides, oldIndex, newIndex)
      setSlides(newSlides)

      // Persist new order to the API
      try {
        const response = await fetch('/api/slides/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slideIds: newSlides.map((s) => s.id),
          }),
        })
        if (!response.ok) throw new Error(`Reorder: ${response.status}`)
      } catch (error) {
        console.error('Error reordering slides:', error)
        setActionError("Couldn't save the new order. Please try again.")
      }
      // Q74: the server's order either way. On a refusal it puts the list back; on success each
      // slide gets its new `order` (it kept the old one, and an edit saved after a drag undid it).
      fetchSlides()
    }
  }

  // gallery.md §2 (Q4): Content / Landing page, in place of an eyebrow.
  const breadcrumb = (
    <AdminBreadcrumb
      items={[{ label: 'Content', href: '/admin/content' }, { label: 'Landing page' }]}
    />
  )

  // Add slide waits for the list (it numbers the new slide after the last).
  if (status === 'loading' || loading) {
    return (
      <div className={styles.page}>
        {breadcrumb}
        <AdminPageHeader title={TITLE} description={DESCRIPTION} />
        <p className={styles.status}>Loading slides…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {breadcrumb}
      <AdminPageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={
          <>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              prefetch={false}
              className={styles.view}
            >
              View homepage
              <ArrowSquareOut size={16} weight="light" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
            {/* Add numbers the new slide after the last: not without the list (Q74). */}
            {!loadError && (
              <Button
                variant="bare"
                font="dashboard"
                className={styles.add}
                onClick={handleAddSlide}
              >
                <Plus size={16} weight="light" aria-hidden />
                Add slide
              </Button>
            )}
          </>
        }
      />

      {/* No ×: a dismissed load error would leave an empty page (as Q75). */}
      {loadError && (
        <Callout tone="red" role="alert">
          The slides could not be loaded.
        </Callout>
      )}
      {actionError && (
        <FeedbackBar tone="error" onDismiss={() => setActionError('')}>
          {actionError}
        </FeedbackBar>
      )}

      {loadError ? null : slides.length === 0 ? (
        <ListPanel label="Slides">
          <EmptyState
            title="No slides yet."
            text={
              <>
                Click <strong>Add slide</strong> to create one.
              </>
            }
          />
        </ListPanel>
      ) : (
        <ListPanel
          label="Slides"
          count={slidesCount(slides.length)}
          footnote={SORTABLE_KEYBOARD_HINT}
        >
          <SortableList
            onDragEnd={handleDragEnd}
            rows={slides.map((slide) => {
              const title = slideTitle(slide)
              return {
                id: slide.id,
                title,
                sub:
                  // A slide created by an image upload and never saved is off the homepage (Q74).
                  [
                    slide.isActive ? '' : 'Not on the homepage until saved',
                    slide.subtitle,
                    slide.meta,
                  ]
                    .map((part) => part.trim())
                    .filter(Boolean)
                    .join(' · ') || undefined,
                thumb: slide.imageUrl ? (
                  <img src={slide.imageUrl} alt="" className={styles.thumb} />
                ) : (
                  <span className={styles.thumb} />
                ),
                actions: (
                  <>
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={styles.edit}
                      onClick={() => handleEditSlide(slide)}
                    >
                      <PencilSimple size={16} weight="light" aria-hidden />
                      Edit
                    </Button>
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={styles.trash}
                      aria-label={`Delete slide ${title}`}
                      onClick={() => setDeleteTarget(slide)}
                    >
                      <Trash size={16} weight="light" aria-hidden />
                    </Button>
                  </>
                ),
              }
            })}
          />
        </ListPanel>
      )}

      {/* Edit/Add Modal */}
      {editingSlide && (
        <Modal onClose={() => setEditingSlide(null)} maxWidth="720px">
          <div className={styles.slideModal}>
            <Text font="dashboard" as="h2" className={styles.slideModalTitle}>
              {isNewSlide ? 'Add slide' : 'Edit slide'}
            </Text>

            {/* Only this middle part scrolls: the title and Save stay in view
                on short laptop screens. */}
            <div className={styles.slideModalBody}>
              <div className={styles.section}>
                <label className={styles.label}>Desktop image</label>
                <ImageUploader
                  imageUrl={editingSlide.imageUrl || null}
                  onUpload={(file) => handleSlideUpload(file, 'desktop')}
                  onRemove={editingSlide.id ? () => handleSlideImageRemove('desktop') : undefined}
                  uploading={uploading === 'desktop'}
                  error={uploadErrors.desktop}
                  aspectRatio="16 / 9"
                  objectFit="contain"
                />

                <label className={styles.label}>Mobile &amp; tablet image (optional)</label>
                <Text font="dashboard" as="p" size="sm" className={styles.hint}>
                  Shown on screens narrower than 1024px, cropped from the center. Pick a portrait
                  image with a calm area behind the text. Without one, the desktop image is used
                  everywhere.
                </Text>
                <div className={styles.mobileUploader}>
                  <ImageUploader
                    imageUrl={editingSlide.mobileImageUrl || null}
                    onUpload={(file) => handleSlideUpload(file, 'mobile')}
                    onRemove={editingSlide.id ? () => handleSlideImageRemove('mobile') : undefined}
                    uploading={uploading === 'mobile'}
                    error={uploadErrors.mobile}
                    aspectRatio="3 / 4"
                    objectFit="contain"
                  />
                </div>

                <label className={styles.label} htmlFor="title">
                  Title
                </label>
                <Input
                  id="title"
                  size="medium"
                  value={editingSlide.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />

                <label className={styles.label} htmlFor="subtitle">
                  Subtitle
                </label>
                <Input
                  id="subtitle"
                  size="medium"
                  value={editingSlide.subtitle}
                  onChange={(e) => updateField('subtitle', e.target.value)}
                />

                <label className={styles.label} htmlFor="meta">
                  Meta
                </label>
                <Input
                  id="meta"
                  size="medium"
                  value={editingSlide.meta}
                  onChange={(e) => updateField('meta', e.target.value)}
                />

                <label className={styles.label} htmlFor="exhibitionUrl">
                  Exhibition URL
                </label>
                <Input
                  id="exhibitionUrl"
                  size="medium"
                  value={editingSlide.exhibitionUrl}
                  onChange={(e) => updateField('exhibitionUrl', e.target.value)}
                />

                <label className={styles.label}>Text color</label>
                <ColorPicker
                  textColor={editingSlide.textColor || '#ffffff'}
                  onColorSelect={(color) => updateField('textColor', color)}
                />

                <label className={styles.label}>Enter button background</label>
                <ColorPicker
                  textColor={editingSlide.ctaBackgroundColor || '#ffffff'}
                  onColorSelect={(color) => updateField('ctaBackgroundColor', color)}
                />

                <label className={styles.label}>Enter button text</label>
                <ColorPicker
                  textColor={editingSlide.ctaTextColor || '#000000'}
                  onColorSelect={(color) => updateField('ctaTextColor', color)}
                />
                <Text font="dashboard" as="p" size="sm" className={styles.hint}>
                  The &ldquo;Enter Virtual Exhibition&rdquo; button shows on laptops and desktops
                  when the exhibition&apos;s 3D space is published, and opens it directly.
                </Text>
              </div>
            </div>

            <div className={styles.slideModalActions}>
              {saveFailed && (
                <p role="alert" className={styles.saveFailed}>
                  Not saved. Please try again.
                </p>
              )}
              <Button
                font="dashboard"
                variant="secondary"
                label="Cancel"
                onClick={() => setEditingSlide(null)}
              />
              <Button
                font="dashboard"
                variant="primary"
                label={saving ? 'Saving…' : 'Save'}
                onClick={handleSaveSlide}
              />
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <AdminConfirmModal
          title="Delete slide?"
          message={`Are you sure you want to delete the slide "${slideTitle(deleteTarget)}"?`}
          confirmLabel="Yes, delete"
          destructive
          onConfirm={handleDeleteSlide}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
