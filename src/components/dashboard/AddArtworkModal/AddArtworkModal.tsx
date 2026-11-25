'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Cube,
  Image as ImageIcon,
  SpeakerHigh,
  TextT,
  VideoCamera,
  type Icon,
} from '@phosphor-icons/react'
import c from 'classnames'

import { AdminConfirmModal } from '@/components/admin/ui/AdminConfirmModal'
import { Input } from '@/components/ui/Input'

import styles from './AddArtworkModal.module.scss'

/** The type cards, in the board's order (objects-add-artwork.dc.html). */
const ARTWORK_TYPES: { value: string; label: string; icon: Icon }[] = [
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'object', label: 'Object', icon: Cube },
  { value: 'text', label: 'Text', icon: TextT },
  { value: 'sound', label: 'Sound', icon: SpeakerHigh },
  { value: 'video', label: 'Video', icon: VideoCamera },
]

const OBJECT_EXPLAINER_ID = 'add-artwork-object-explainer'

/** The explainer's figure: a standing sculpture, as drawn on the board. Decorative. */
const SCULPTURE_PATH =
  'M14 96 C6 70 14 40 22 26 C14 14 22 2 30 2 C38 2 46 14 38 26 C46 40 54 70 46 96 Z'

// The confirm button sits outside the <form> (in the dialog's button row) and
// submits it through this id.
const FORM_ID = 'add-artwork-form'

type AddArtworkModalProps = {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

/**
 * Add artwork (artist.md §2: today's dialog in the admin look, like Add user):
 * labels above the fields, today's help text under them, Cancel / Create artwork.
 * The type is a row of cards (docs/objects, objects-add-artwork.dc.html); choosing
 * Object explains it in one panel under them.
 */
export const AddArtworkModal = ({ userId, onClose, onSuccess }: AddArtworkModalProps) => {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    artworkType: 'image',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/artworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: formData.title,
          artworkType: formData.artworkType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to create artwork')
        setLoading(false)
        return
      }

      const artwork = await response.json()

      onSuccess()
      onClose()

      // Redirect to edit page
      router.push(`/dashboard/artworks/${artwork.id}/edit`)
    } catch {
      setError('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <AdminConfirmModal
      icon={null}
      title="Add artwork"
      message={
        <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">
              Title
            </label>
            <Input
              id="title"
              type="text"
              size="bare"
              inputClassName={styles.input}
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Sunset Painting"
            />
            <span className={styles.help}>
              Give your artwork a name. You can change this later. Leave empty to auto-generate a
              title.
            </span>
          </div>

          <fieldset className={styles.types}>
            <legend className={styles.label}>Type</legend>
            <div className={styles.typeCards}>
              {ARTWORK_TYPES.map(({ value, label, icon: TypeIcon }) => {
                const checked = formData.artworkType === value
                return (
                  <label key={value} className={c(styles.typeCard, checked && styles.checked)}>
                    <input
                      type="radio"
                      name="artworkType"
                      value={value}
                      checked={checked}
                      onChange={() => handleChange('artworkType', value)}
                      className="sr-only"
                      aria-describedby={
                        value === 'object' && checked ? OBJECT_EXPLAINER_ID : undefined
                      }
                    />
                    <TypeIcon size={24} weight="light" aria-hidden />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
            {formData.artworkType === 'object' && (
              <div id={OBJECT_EXPLAINER_ID} className={styles.explainer}>
                <span aria-hidden className={styles.explainerFigure}>
                  <svg width="30" height="48" viewBox="0 0 60 100">
                    <path d={SCULPTURE_PATH} />
                  </svg>
                </span>
                <span className={styles.explainerText}>
                  <strong>Object: a sculpture or any piece with volume</strong>
                  <span>
                    You add a cover photo, more photos and reels, and the details. It shows in your
                    exhibitions like any other artwork.
                  </span>
                  <span>
                    Want it in the 3D room too? We turn it into a 3D model for you. You can ask for
                    that later.
                  </span>
                </span>
              </div>
            )}
          </fieldset>
        </form>
      }
      warning={error || undefined}
      confirmLabel="Create artwork"
      busyLabel="Creating…"
      busy={loading}
      form={FORM_ID}
      onCancel={onClose}
    />
  )
}
