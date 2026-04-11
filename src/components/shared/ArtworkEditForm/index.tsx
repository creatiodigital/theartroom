'use client'

import { useRef, useState, useCallback } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { Icon } from '@/components/ui/Icon'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import styles from './ArtworkEditForm.module.scss'

// Strip HTML tags from text content (for content saved with RichTextEditor previously)
export const stripHtml = (html: string): string => {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersands
    .replace(/&lt;/g, '<') // Replace less than
    .replace(/&gt;/g, '>') // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .trim()
}

export type Artwork = {
  id: string
  userId: string
  name: string
  artworkType: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  description: string | null
  imageUrl: string | null
  textContent: string | null
  soundUrl: string | null
  featured: boolean
  hiddenFromExhibition: boolean
}

export type ArtworkFormData = {
  name: string
  artworkType: string
  title: string
  author: string
  year: string
  technique: string
  dimensions: string
  description: string
  textContent: string
  featured: boolean
  hiddenFromExhibition: boolean
}

export const getInitialFormData = (): ArtworkFormData => ({
  name: '',
  artworkType: 'image',
  title: '',
  author: '',
  year: '',
  technique: '',
  dimensions: '',
  description: '',
  textContent: '',
  featured: false,
  hiddenFromExhibition: false,
})

export const populateFormData = (data: Artwork): ArtworkFormData => ({
  name: data.name || '',
  artworkType: data.artworkType || 'image',
  title: data.title || '',
  author: data.author || '',
  year: data.year || '',
  technique: data.technique || '',
  dimensions: data.dimensions || '',
  description: data.description || '',
  textContent: stripHtml(data.textContent || ''),
  featured: data.featured ?? false,
  hiddenFromExhibition: data.hiddenFromExhibition ?? false,
})

type ArtworkEditFormProps = {
  formData: ArtworkFormData
  imageUrl: string | null
  soundUrl?: string | null
  videoUrl?: string | null
  uploading: boolean
  loadingText?: string
  saving: boolean
  error: string
  onFormChange: (field: string, value: string | boolean) => void
  onImageUpload: (file: File) => Promise<void>
  onImageRemove: () => void | Promise<void>
  onSoundUpload?: (file: File) => Promise<void>
  onSoundRemove?: () => void | Promise<void>
  onVideoUpload?: (file: File) => Promise<void>
  onVideoRemove?: () => void | Promise<void>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

const ALLOWED_SOUND_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
]
const MAX_SOUND_SIZE = 3 * 1024 * 1024 // 3MB

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB

export const ArtworkEditForm = ({
  formData,
  imageUrl,
  soundUrl,
  videoUrl,
  uploading,
  loadingText = 'Uploading...',
  saving,
  error,
  onFormChange,
  onImageUpload,
  onImageRemove,
  onSoundUpload,
  onSoundRemove,
  onVideoUpload,
  onVideoRemove,
  onSubmit,
  onCancel,
}: ArtworkEditFormProps) => {
  const soundInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingSound, setIsDraggingSound] = useState(false)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [soundSizeError, setSoundSizeError] = useState<string | null>(null)
  const [videoSizeError, setVideoSizeError] = useState<string | null>(null)

  const handleSoundFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onSoundUpload) {
        if (file.size > MAX_SOUND_SIZE) {
          setSoundSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 3MB.`,
          )
          if (soundInputRef.current) soundInputRef.current.value = ''
          return
        }
        setSoundSizeError(null)
        await onSoundUpload(file)
      }
      if (soundInputRef.current) soundInputRef.current.value = ''
    },
    [onSoundUpload],
  )

  const handleSoundDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingSound(false)
      const file = e.dataTransfer.files?.[0]
      if (file && ALLOWED_SOUND_TYPES.includes(file.type) && onSoundUpload) {
        if (file.size > MAX_SOUND_SIZE) {
          setSoundSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 3MB.`,
          )
          return
        }
        setSoundSizeError(null)
        await onSoundUpload(file)
      }
    },
    [onSoundUpload],
  )

  const handleVideoFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onVideoUpload) {
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 50MB.`,
          )
          if (videoInputRef.current) videoInputRef.current.value = ''
          return
        }
        setVideoSizeError(null)
        await onVideoUpload(file)
      }
      if (videoInputRef.current) videoInputRef.current.value = ''
    },
    [onVideoUpload],
  )

  const handleVideoDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingVideo(false)
      const file = e.dataTransfer.files?.[0]
      if (file && ALLOWED_VIDEO_TYPES.includes(file.type) && onVideoUpload) {
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 50MB.`,
          )
          return
        }
        setVideoSizeError(null)
        await onVideoUpload(file)
      }
    },
    [onVideoUpload],
  )

  return (
    <>
      {/* Page Title */}
      <h1 className={dashboardStyles.pageTitle}>Edit Artwork</h1>

      {/* Video File Upload Section - only for video type */}
      {formData.artworkType === 'video' && (
        <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
          <h3 className={dashboardStyles.sectionTitle}>Video File</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload the video file. This will be played in exhibitions.
          </p>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleVideoFileSelect}
            className={styles.hiddenInput}
          />

          {videoUrl ? (
            <div className={styles.soundPreview}>
              <div className={styles.soundInfo}>
                <Icon name="video" size={24} color="#333" />
                <video
                  controls
                  controlsList="nodownload"
                  src={videoUrl}
                  className={styles.videoPlayer}
                >
                  Your browser does not support the video element.
                </video>
              </div>
              {onVideoRemove && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Remove"
                  onClick={() => onVideoRemove()}
                  type="button"
                />
              )}
            </div>
          ) : (
            <div
              className={`${styles.soundDropzone} ${isDraggingVideo ? styles.dragging : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingVideo(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingVideo(false)
              }}
              onDrop={handleVideoDrop}
              onClick={() => videoInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && videoInputRef.current?.click()}
            >
              {uploading ? (
                <span className={styles.uploadingText}>{loadingText}</span>
              ) : (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    label="Select a Video File"
                    onClick={(e) => {
                      e.stopPropagation()
                      videoInputRef.current?.click()
                    }}
                    type="button"
                  />
                  <span className={styles.dropText}>or drag and drop files</span>
                </>
              )}
            </div>
          )}

          {videoSizeError && <div className={styles.sizeError}>{videoSizeError}</div>}
          <span className={dashboardStyles.hint}>
            Accepted: MP4, WebM (max 50MB). Videos are automatically optimized for the gallery.
          </span>
        </div>
      )}

      {/* Image Upload Section - for image and video types (poster for video) */}
      {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
        <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
          <h3 className={dashboardStyles.sectionTitle}>
            {formData.artworkType === 'video' ? 'Video Poster' : 'Artwork Image'}
          </h3>
          <p className={dashboardStyles.sectionDescription}>
            {formData.artworkType === 'video'
              ? 'Optional. Upload a poster image for this video. If not provided, the first frame of the video will be used.'
              : 'Upload the artwork image. This will be displayed in exhibitions and on your profile.'}
          </p>
          <ImageUploader
            imageUrl={imageUrl}
            onUpload={onImageUpload}
            onRemove={onImageRemove}
            uploading={uploading}
            loadingText={loadingText}
            aspectRatio="1 / 1"
            objectFit="contain"
          />
          <span className={dashboardStyles.hint}>
            Accepted: JPG, PNG, WebP, GIF (max 1MB). Images are automatically optimized.
          </span>
        </div>
      )}

      {/* Sound Upload Section - only for sound type */}
      {formData.artworkType === 'sound' && (
        <div className={`${dashboardStyles.section} ${styles.imageSection}`}>
          <h3 className={dashboardStyles.sectionTitle}>Audio File</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload an audio file. This sound will be playable in exhibitions.
          </p>

          <input
            ref={soundInputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,audio/x-wav,audio/aac,audio/flac"
            onChange={handleSoundFileSelect}
            className={styles.hiddenInput}
          />

          {soundUrl ? (
            <div className={styles.soundPreview}>
              <div className={styles.soundInfo}>
                <Icon name="volume-2" size={24} color="#333" />
                <audio controls src={soundUrl} className={styles.audioPlayer}>
                  Your browser does not support the audio element.
                </audio>
              </div>
              {onSoundRemove && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Remove"
                  onClick={() => onSoundRemove()}
                  type="button"
                />
              )}
            </div>
          ) : (
            <div
              className={`${styles.soundDropzone} ${isDraggingSound ? styles.dragging : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingSound(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingSound(false)
              }}
              onDrop={handleSoundDrop}
              onClick={() => soundInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && soundInputRef.current?.click()}
            >
              {uploading ? (
                <span className={styles.uploadingText}>{loadingText}</span>
              ) : (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    label="Select an Audio File"
                    onClick={(e) => {
                      e.stopPropagation()
                      soundInputRef.current?.click()
                    }}
                    type="button"
                  />
                  <span className={styles.dropText}>or drag and drop files</span>
                </>
              )}
            </div>
          )}

          {soundSizeError && <div className={styles.sizeError}>{soundSizeError}</div>}
          <span className={dashboardStyles.hint}>
            Accepted: MP3, M4A, OGG, WebM, WAV, AAC, FLAC (max 3MB).
          </span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        {/* Title Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Title</h3>
          <p className={dashboardStyles.sectionDescription}>The display title for your artwork.</p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => onFormChange('title', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>
            This will be shown in exhibitions and on your profile.
          </span>
        </div>

        {/* Type Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Type</h3>
          <p className={dashboardStyles.sectionDescription}>
            The artwork type cannot be changed after creation.
          </p>
          <Input
            id="artworkType"
            type="text"
            size="medium"
            value={
              formData.artworkType === 'image'
                ? 'Image'
                : formData.artworkType === 'sound'
                  ? 'Sound'
                  : formData.artworkType === 'video'
                    ? 'Video'
                    : 'Text'
            }
            onChange={() => {}}
            variant="disabled"
          />
          <span className={dashboardStyles.hint}>
            Image for visual artworks, Text for written content, Sound for audio, Video for video
            artworks.
          </span>
        </div>

        {/* Author */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Author</h3>
            <Input
              id="author"
              type="text"
              size="medium"
              value={formData.author}
              onChange={(e) => onFormChange('author', e.target.value)}
            />
          </div>
        )}

        {/* Year */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Year</h3>
            <Input
              id="year"
              type="text"
              size="medium"
              value={formData.year}
              onChange={(e) => onFormChange('year', e.target.value)}
            />
          </div>
        )}

        {/* Technique / Medium */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Technique / Medium</h3>
            <RichTextEditor
              content={formData.technique}
              onChange={(content) => onFormChange('technique', content)}
              placeholder="e.g. Oil on canvas, mixed media..."
            />
          </div>
        )}

        {/* Dimensions */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Dimensions</h3>
            <Input
              id="dimensions"
              type="text"
              size="medium"
              value={formData.dimensions}
              onChange={(e) => onFormChange('dimensions', e.target.value)}
            />
          </div>
        )}

        {/* Text Content - for text artworks (plain text only for 3D) */}
        {formData.artworkType === 'text' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Text Content</h3>
            <p className={dashboardStyles.sectionDescription}>
              Plain text content that will be displayed on the 3D stencil.
            </p>
            <textarea
              value={formData.textContent}
              onChange={(e) => onFormChange('textContent', e.target.value)}
              placeholder="Enter the text to display..."
              rows={8}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
            />
            <span className={dashboardStyles.hint}>
              Text styling (font, weight, size) is limited in 3D and can be adjusted in the wall
              panel.
            </span>
          </div>
        )}

        {/* Description - for image artworks (supports rich text) */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Description</h3>
            <RichTextEditor
              content={formData.description}
              onChange={(content) => onFormChange('description', content)}
              placeholder="About this artwork..."
            />
          </div>
        )}

        {/* Featured Checkbox */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Featured Artwork</h3>
            <p className={dashboardStyles.sectionDescription}>
              Highlight this artwork on your public artist profile.
            </p>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => onFormChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
            <span className={dashboardStyles.hint}>
              Featured artworks appear prominently in your profile&apos;s artwork grid.
            </span>
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={dashboardStyles.actions}>
          <Button
            font="dashboard"
            variant="primary"
            label={saving ? 'Saving...' : 'Save'}
            type="submit"
          />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={onCancel}
            type="button"
          />
        </div>
      </form>
    </>
  )
}
