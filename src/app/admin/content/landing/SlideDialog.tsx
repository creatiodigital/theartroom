'use client'

import { useId, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'

import { useAdminDialog } from '@/components/admin/shell/AdminDialogContext'
import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

import type { Slide, SlideImageVariant } from './slide'
import styles from './SlideDialog.module.scss'

type SlideDialogProps = {
  slide: Slide
  isNew: boolean
  /** "Slide 2 of 3" beside the title. */
  position: string
  /** Something differs from when the window opened: "Unsaved changes", and Save is offered. */
  dirty: boolean
  /** Save is offered even unchanged (a slide created by an upload and never saved, Q74). */
  canSave: boolean
  saving: boolean
  saveFailed: boolean
  uploading: SlideImageVariant | null
  uploadErrors: Partial<Record<SlideImageVariant, string>>
  onUpload: (file: File, variant: SlideImageVariant) => Promise<void>
  /** Absent until the slide exists (an image upload creates it). */
  onRemove?: (variant: SlideImageVariant) => void
  onField: (field: keyof Slide, value: string) => void
  onSave: () => void
  onCancel: () => void
}

// The accepted files, as ImageUploader checks them (JPG, PNG or TIFF, up to 1 MB); the server
// stores a WebP.
const FILE_NOTE = 'JPG, PNG or TIFF · up to 1 MB'

/**
 * Admin · Content › Landing page · Edit slide (owner, 2026-11-13, from the design canvas): both
 * images side by side with their actions under each, the fields below, the footer always in view.
 * The fields are today's minus the two button colors (the slide's button went in AR-174) and
 * without a button text (owner: left out); Meta and Text color stay, as the homepage shows them.
 */
export function SlideDialog({
  slide,
  isNew,
  position,
  dirty,
  canSave,
  saving,
  saveFailed,
  uploading,
  uploadErrors,
  onUpload,
  onRemove,
  onField,
  onSave,
  onCancel,
}: SlideDialogProps) {
  const titleId = useId()
  const { layer, hold } = useAdminDialog()

  useLayoutEffect(() => hold(), [hold])

  if (!layer) return null

  return createPortal(
    <Modal
      tone="admin"
      layout="flush"
      titleId={titleId}
      maxWidth="880px"
      phoneFullScreen
      onClose={onCancel}
    >
      <div className={styles.dialog}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {isNew ? 'Add slide' : 'Edit slide'}
          </h2>
          <span className={styles.position}>{position}</span>
          <Button variant="bare" className={styles.close} onClick={onCancel} aria-label="Close">
            <X size={18} weight="light" aria-hidden />
          </Button>
        </div>

        {/* Only this middle part scrolls: the title and Save stay in view. */}
        <div className={styles.body}>
          <div className={styles.images}>
            <div className={styles.image}>
              <span className={styles.label}>Desktop image</span>
              <span className={styles.hint}>Screens 1024 px and wider · cropped to fill</span>
              <ImageUploader
                tone="admin"
                adminLayout="stacked"
                imageUrl={slide.imageUrl || null}
                onUpload={(file) => onUpload(file, 'desktop')}
                onRemove={onRemove ? () => onRemove('desktop') : undefined}
                uploading={uploading === 'desktop'}
                error={uploadErrors.desktop}
                aspectRatio="16 / 9"
                objectFit="cover"
                dropPrompt="Drop a landscape image here"
                note={FILE_NOTE}
              />
            </div>
            <div className={styles.image}>
              <span className={styles.label}>Mobile &amp; tablet image</span>
              <span className={styles.hint}>Optional · narrower screens</span>
              <ImageUploader
                tone="admin"
                adminLayout="stacked"
                imageUrl={slide.mobileImageUrl || null}
                onUpload={(file) => onUpload(file, 'mobile')}
                onRemove={onRemove ? () => onRemove('mobile') : undefined}
                uploading={uploading === 'mobile'}
                error={uploadErrors.mobile}
                aspectRatio="4 / 5"
                objectFit="cover"
                dropPrompt="Drop a portrait image here"
                note={FILE_NOTE}
              />
            </div>
          </div>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="slide-title">
                Title
              </label>
              <Input
                id="slide-title"
                size="medium"
                value={slide.title}
                onChange={(e) => onField('title', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="slide-text">
                Text (optional)
              </label>
              <Input
                id="slide-text"
                size="medium"
                placeholder="One short line under the title"
                value={slide.subtitle}
                onChange={(e) => onField('subtitle', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="slide-meta">
                Meta (optional)
              </label>
              <Input
                id="slide-meta"
                size="medium"
                placeholder="Dates and place, above the title"
                value={slide.meta}
                onChange={(e) => onField('meta', e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="slide-link">
                  Link
                </label>
                <Input
                  id="slide-link"
                  size="medium"
                  placeholder="/exhibitions/…"
                  value={slide.exhibitionUrl}
                  onChange={(e) => onField('exhibitionUrl', e.target.value)}
                />
              </div>
              <div className={styles.color}>
                <ColorPicker
                  variant="field"
                  name="Text color"
                  textColor={slide.textColor || '#ffffff'}
                  onColorSelect={(color) => onField('textColor', color)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.foot}>
          {saveFailed ? (
            <p role="alert" className={styles.saveFailed}>
              Not saved. Please try again.
            </p>
          ) : (
            dirty && <span className={styles.unsaved}>Unsaved changes</span>
          )}
          <div className={styles.actions}>
            <Button font="dashboard" variant="secondary" label="Cancel" onClick={onCancel} />
            <Button
              font="dashboard"
              variant="primary"
              label={saving ? 'Saving…' : isNew ? 'Add slide' : 'Save changes'}
              disabled={saving || !canSave}
              onClick={onSave}
            />
          </div>
        </div>
      </div>
    </Modal>,
    layer,
  )
}
