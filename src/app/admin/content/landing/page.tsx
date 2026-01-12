'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Text } from '@/components/ui/Typography'

import styles from './page.module.scss'

type Slide = {
  id: string
  order: number
  imageUrl: string
  title: string
  subtitle: string
  meta: string
  exhibitionUrl: string
  isActive: boolean
}

export default function LandingContentPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null)
  const [isNewSlide, setIsNewSlide] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null)

  // Redirect non-admins
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    } else if (status === 'authenticated' && session?.user?.userType !== 'admin') {
      router.push('/')
    }
  }, [status, session, router])

  const fetchSlides = useCallback(async () => {
    try {
      const response = await fetch('/api/slides')
      const data = await response.json()
      setSlides(data)
    } catch (error) {
      console.error('Error fetching slides:', error)
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
      title: '',
      subtitle: '',
      meta: '',
      exhibitionUrl: '',
      isActive: true,
    })
    setIsNewSlide(true)
  }

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide)
    setIsNewSlide(false)
  }

  const handleSaveSlide = async () => {
    if (!editingSlide) return

    setSaving(true)
    try {
      const url = isNewSlide ? '/api/slides' : `/api/slides/${editingSlide.id}`
      const method = isNewSlide ? 'POST' : 'PUT'

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSlide),
      })

      await fetchSlides()
      setEditingSlide(null)
    } catch (error) {
      console.error('Error saving slide:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSlide = async () => {
    if (!deleteTarget) return

    try {
      await fetch(`/api/slides/${deleteTarget.id}`, { method: 'DELETE' })
      await fetchSlides()
      setDeleteTarget(null)
    } catch (error) {
      console.error('Error deleting slide:', error)
    }
  }

  const updateField = (field: keyof Slide, value: string | number | boolean) => {
    if (!editingSlide) return
    setEditingSlide({ ...editingSlide, [field]: value })
  }

  if (status === 'loading' || loading) {
    return <div className={styles.page}>Loading...</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Text font="dashboard" as="h1">Landing Page - Slideshow</Text>
        <Button font="dashboard" variant="secondary" label="← Back to Dashboard" onClick={() => router.push('/admin')} />
      </div>

      <div className={styles.actions}>
        <Button font="dashboard" variant="secondary" label="+ Add Slide" onClick={handleAddSlide} />
      </div>

      {slides.length === 0 ? (
        <Text font="dashboard" as="p" className={styles.empty}>No slides yet. Click "Add Slide" to create one.</Text>
      ) : (
        <div className={styles.slideList}>
          {slides.map((slide) => (
            <div key={slide.id} className={styles.slideItem}>
              <div className={styles.slidePreview}>
                {slide.imageUrl && (
                  <img src={slide.imageUrl} alt={slide.title} className={styles.slideImage} />
                )}
              </div>
              <div className={styles.slideInfo}>
                <Text font="dashboard" as="h3">{slide.title}</Text>
                <Text font="dashboard" as="p" className={styles.subtitle}>{slide.subtitle}</Text>
                <Text font="dashboard" as="p" className={styles.meta}>{slide.meta}</Text>
              </div>
              <div className={styles.slideActions}>
                <Button font="dashboard" variant="secondary" label="Edit" onClick={() => handleEditSlide(slide)} />
                <Button font="dashboard" variant="primary" label="Remove" onClick={() => setDeleteTarget(slide)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Add Modal */}
      {editingSlide && (
        <Modal onClose={() => setEditingSlide(null)}>
          <div className={styles.modal}>
            <Text font="dashboard" as="h2">{isNewSlide ? 'Add Slide' : 'Edit Slide'}</Text>

            <div className={styles.field}>
              <Text font="dashboard" as="label">Image URL</Text>
              <Input
                id="imageUrl"
                value={editingSlide.imageUrl}
                onChange={(e) => updateField('imageUrl', e.target.value)}
                placeholder="/assets/landing/image.webp"
              />
            </div>

            <div className={styles.field}>
              <Text font="dashboard" as="label">Title (Artist Name)</Text>
              <Input
                id="title"
                value={editingSlide.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Ana Mendieta"
              />
            </div>

            <div className={styles.field}>
              <Text font="dashboard" as="label">Subtitle (Exhibition Name)</Text>
              <Input
                id="subtitle"
                value={editingSlide.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="Back to the Source"
              />
            </div>

            <div className={styles.field}>
              <Text font="dashboard" as="label">Meta (Date + Location)</Text>
              <Input
                id="meta"
                value={editingSlide.meta}
                onChange={(e) => updateField('meta', e.target.value)}
                placeholder="7 NOVEMBER 2025 – 17 JANUARY 2026    NEW YORK"
              />
            </div>

            <div className={styles.field}>
              <Text font="dashboard" as="label">Exhibition URL</Text>
              <Input
                id="exhibitionUrl"
                value={editingSlide.exhibitionUrl}
                onChange={(e) => updateField('exhibitionUrl', e.target.value)}
                placeholder="/exhibitions/handler/exhibition-url"
              />
            </div>

            <div className={styles.field}>
              <Text font="dashboard" as="label">Order</Text>
              <Input
                id="order"
                value={String(editingSlide.order)}
                onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                label={saving ? 'Saving...' : 'Save'}
                onClick={handleSaveSlide}
              />
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => setEditingSlide(null)} />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className={styles.modal}>
            <Text font="dashboard" as="h2">Delete Slide?</Text>
            <Text font="dashboard" as="p">
              Are you sure you want to delete the slide "{deleteTarget.title}"?
            </Text>
            <div className={styles.modalActions}>
              <Button font="dashboard" variant="primary" label="Yes, Delete" onClick={handleDeleteSlide} />
              <Button font="dashboard" variant="secondary" label="Cancel" onClick={() => setDeleteTarget(null)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
