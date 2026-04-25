'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { Icon } from '@/components/ui/Icon'
import { ImageUploader } from '@/components/ui/ImageUploader'
import type { ImageMeta } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'
import { FORMATS, FRAME_COLORS, MOUNTS, PAPERS, SIZES } from '@/components/PrintWizard/options'
import type { PrintOptions } from '@/components/PrintWizard/types'
import {
  MAX_ARTWORK_UPLOAD_SIZE,
  MIN_ARTWORK_IMAGE_WIDTH,
  MIN_ARTWORK_IMAGE_HEIGHT,
  MIN_PRINT_WIDTH,
  MIN_PRINT_HEIGHT,
} from '@/lib/imageConfig'

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
  originalImageUrl: string | null
  originalDpi: number | null
  textContent: string | null
  soundUrl: string | null
  featured: boolean
  hiddenFromExhibition: boolean
  printEnabled?: boolean
  printPriceCents?: number | null
  printOptions?: PrintOptions | null
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
  printEnabled: boolean
  /** Euros as a string for the input field; converted to cents at submit. */
  printPriceEuros: string
  /** Artist-set restrictions. null = no restrictions (all options offered). */
  printOptions: PrintOptions | null
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
  printEnabled: false,
  printPriceEuros: '',
  printOptions: null,
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
  printEnabled: data.printEnabled ?? false,
  printPriceEuros:
    typeof data.printPriceCents === 'number' ? (data.printPriceCents / 100).toString() : '',
  printOptions: data.printOptions ?? null,
})

type ArtworkEditFormProps = {
  formData: ArtworkFormData
  imageUrl: string | null
  imageDpi?: number | null
  originalWidth?: number | null
  originalHeight?: number | null
  originalImageUrl?: string | null
  originalFormat?: string | null
  originalSizeBytes?: number | null
  soundUrl?: string | null
  videoUrl?: string | null
  uploading: boolean
  loadingText?: string
  saving: boolean
  error: string
  onFormChange: (field: string, value: string | boolean) => void
  /** Replace the whole printOptions object. Called as the artist (un)checks boxes. */
  onPrintOptionsChange?: (next: PrintOptions | null) => void
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

const MIN_DPI = 300

type PrintSizeEligibility = {
  label: string
  widthCm: number
  heightCm: number
  requiredWidth: number
  requiredHeight: number
  eligible: boolean
  effectiveDpiW: number
  effectiveDpiH: number
}

function getPrintSizeEligibility(meta: ImageMeta | null): PrintSizeEligibility[] {
  return SIZES.map((size) => {
    const requiredWidth = Math.ceil((size.widthCm / 2.54) * MIN_DPI)
    const requiredHeight = Math.ceil((size.heightCm / 2.54) * MIN_DPI)
    const printWidthInches = size.widthCm / 2.54
    const printHeightInches = size.heightCm / 2.54
    const effectiveDpiW = meta ? Math.round(meta.width / printWidthInches) : 0
    const effectiveDpiH = meta ? Math.round(meta.height / printHeightInches) : 0
    const eligible = meta ? meta.width >= requiredWidth && meta.height >= requiredHeight : false
    return {
      label: size.label,
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      requiredWidth,
      requiredHeight,
      eligible,
      effectiveDpiW,
      effectiveDpiH,
    }
  })
}

function isPrintEligible(meta: ImageMeta | null): boolean {
  if (!meta) return false
  return getPrintSizeEligibility(meta).some((s) => s.eligible)
}

/**
 * SIZES filtered to only those the current image can physically render
 * at 300 DPI. Used to scope the artist's restriction UI — it doesn't
 * make sense to offer a checkbox for a size the image can't fulfil.
 * If we have no meta yet, return everything so the UI isn't empty
 * while the image measures.
 */
function getEligibleSizes(meta: ImageMeta | null) {
  if (!meta) return SIZES
  return SIZES.filter((size) => {
    const requiredWidth = Math.ceil((size.widthCm / 2.54) * MIN_DPI)
    const requiredHeight = Math.ceil((size.heightCm / 2.54) * MIN_DPI)
    return meta.width >= requiredWidth && meta.height >= requiredHeight
  })
}

/**
 * Toggle membership of `id` in the allow-list for one dimension of
 * `PrintOptions`. The UI convention: all-checked means "no restriction"
 * so we drop the allow-list entirely when that dimension ends up matching
 * every id in `all`. Mirror inverse: leaving zero checked reinstates all.
 */
function togglePrintOptionId<K extends keyof PrintOptions>(
  current: PrintOptions | null,
  key: K,
  id: string,
  all: readonly string[],
): PrintOptions | null {
  const currentList = current?.[key] as readonly string[] | undefined
  const effective = currentList && currentList.length > 0 ? [...currentList] : [...all]
  const idx = effective.indexOf(id)
  const next = idx === -1 ? [...effective, id] : effective.filter((x) => x !== id)

  // Artist has re-checked everything or unchecked everything: drop the
  // allow-list so the field reverts to "no restriction" (buyers see all).
  // Zero-length would otherwise mean "nothing allowed" which we treat as
  // the same as "no restriction" to prevent accidental total lockouts.
  const reachesAll = next.length === all.length
  const isEmpty = next.length === 0
  const shouldClearDimension = reachesAll || isEmpty

  const base: PrintOptions = { ...(current ?? {}) }
  if (shouldClearDimension) {
    delete base[key]
  } else {
    ;(base as Record<string, unknown>)[key as string] = next
  }

  // Drop the whole printOptions object when nothing remains restricted.
  const anyRestriction = Object.values(base).some(
    (v) => Array.isArray(v) && v.length > 0 && v.length < all.length,
  )
  return Object.keys(base).length === 0 ? null : anyRestriction ? base : null
}

function isDimensionChecked<K extends keyof PrintOptions>(
  opts: PrintOptions | null,
  key: K,
  id: string,
): boolean {
  const list = opts?.[key] as readonly string[] | undefined
  // No allow-list set → all options allowed → every checkbox is checked.
  if (!list || list.length === 0) return true
  return list.includes(id)
}

type PrintRestrictionGroupProps<K extends keyof PrintOptions> = {
  title: string
  all: Array<{ id: string; label: string }>
  allIds: readonly string[]
  dimensionKey: K
  options: PrintOptions | null
  onChange?: (next: PrintOptions | null) => void
}

const PrintRestrictionGroup = <K extends keyof PrintOptions>({
  title,
  all,
  allIds,
  dimensionKey,
  options,
  onChange,
}: PrintRestrictionGroupProps<K>) => {
  const handleToggle = (id: string) => {
    if (!onChange) return
    onChange(togglePrintOptionId(options, dimensionKey, id, allIds))
  }
  return (
    <div className={styles.printRestrictionGroup}>
      <h4 className={styles.printRestrictionGroupTitle}>{title}</h4>
      <div className={styles.printRestrictionChoices}>
        {all.map((item) => (
          <Checkbox
            key={item.id}
            checked={isDimensionChecked(options, dimensionKey, item.id)}
            onChange={() => handleToggle(item.id)}
            label={item.label}
          />
        ))}
      </div>
    </div>
  )
}

export const ArtworkEditForm = ({
  formData,
  imageUrl,
  imageDpi,
  originalWidth,
  originalHeight,
  originalImageUrl,
  originalFormat,
  originalSizeBytes,
  soundUrl,
  videoUrl,
  uploading,
  loadingText = 'Uploading...',
  saving,
  error,
  onFormChange,
  onPrintOptionsChange,
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
  // If server has original file info, use that directly instead of reading from CDN image
  const serverMeta = useMemo<ImageMeta | null>(() => {
    if (originalWidth && originalHeight) {
      return {
        width: originalWidth,
        height: originalHeight,
        format: originalFormat ?? 'Image',
        sizeBytes: originalSizeBytes ?? 0,
        dpi: imageDpi ?? undefined,
      }
    }
    return null
  }, [originalWidth, originalHeight, originalFormat, originalSizeBytes, imageDpi])

  const [clientMeta, setClientMeta] = useState<ImageMeta | null>(null)
  const [showPrintInfoModal, setShowPrintInfoModal] = useState(false)

  // Server meta takes priority over client-detected meta
  const imageMeta = serverMeta ?? clientMeta

  const printEligible = isPrintEligible(imageMeta)
  const printSizes = getPrintSizeEligibility(imageMeta)
  const eligibleSizes = printSizes.filter((s) => s.eligible)
  // Actual SizeOption entries the image can physically print at — used
  // to scope the artist's restriction checkboxes for the Sizes group.
  const eligibleSizeOptions = getEligibleSizes(imageMeta)

  const handleImageMetaChange = useCallback((meta: ImageMeta | null) => {
    if (meta && meta.width > 0) {
      setClientMeta(meta)
    } else if (meta === null) {
      setClientMeta(null)
    }
  }, [])

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
        <div className={`${dashboardStyles.section} ${styles.imageSectionHalf}`}>
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
        <div
          className={`${dashboardStyles.section} ${formData.artworkType === 'image' ? styles.imageSection : styles.imageSectionHalf}`}
        >
          <h3 className={dashboardStyles.sectionTitle}>
            {formData.artworkType === 'video' ? 'Video Poster' : 'Artwork Image'}
          </h3>
          <p className={dashboardStyles.sectionDescription}>
            {formData.artworkType === 'video'
              ? 'Optional. Upload a poster image for this video. If not provided, the first frame of the video will be used.'
              : 'Upload the artwork image. This will be displayed in exhibitions and on your profile.'}
          </p>

          <div className={styles.imageRow}>
            <div className={styles.imageUploaderCol}>
              <ImageUploader
                imageUrl={imageUrl}
                onUpload={onImageUpload}
                onRemove={onImageRemove}
                onMetaChange={handleImageMetaChange}
                displayMeta={serverMeta}
                uploading={uploading}
                loadingText={loadingText}
                aspectRatio="1 / 1"
                objectFit="contain"
                maxSizeBytes={MAX_ARTWORK_UPLOAD_SIZE}
                minWidth={MIN_ARTWORK_IMAGE_WIDTH}
                minHeight={MIN_ARTWORK_IMAGE_HEIGHT}
              />
            </div>

            {/* Print requirements info — only for image artworks */}
            {formData.artworkType === 'image' && (
              <div className={styles.printInfoCol}>
                <div className={styles.printInfoCard}>
                  <h4 className={styles.printInfoTitle}>
                    <Icon name="printer" size={16} />
                    Sell as print
                  </h4>
                  <p className={styles.printInfoText}>
                    You can sell physical prints of your artwork through our print-on-demand
                    service. This is completely optional — your artwork will always be displayed in
                    exhibitions regardless of image resolution.
                  </p>
                  <p className={styles.printInfoText}>
                    To enable print sales, your image needs to be high resolution (at least{' '}
                    {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px). The larger the image, the more print
                    sizes will be available to buyers.
                  </p>

                  {/* Per-size eligibility checklist */}
                  {imageUrl && imageMeta ? (
                    <>
                      <p
                        className={styles.printInfoText}
                        style={{ marginBottom: 'var(--space-1)' }}
                      >
                        <strong>Print size eligibility:</strong>
                      </p>
                      <ul className={styles.printSizeChecklist}>
                        {printSizes.map((s) => (
                          <li
                            key={s.label}
                            className={
                              s.eligible ? styles.printSizeEligible : styles.printSizeIneligible
                            }
                          >
                            <Icon name={s.eligible ? 'check-circle' : 'alert-circle'} size={14} />
                            <span>{s.label}</span>
                            <span className={styles.printSizeDpi}>
                              {Math.min(s.effectiveDpiW, s.effectiveDpiH)} DPI
                            </span>
                          </li>
                        ))}
                      </ul>
                      {eligibleSizes.length === 0 && (
                        <div className={styles.printStatusNotReady}>
                          <Icon name="alert-circle" size={16} />
                          <span>
                            This image is {imageMeta.width} × {imageMeta.height} px — below the
                            minimum for any print size. Upload a higher resolution version to enable
                            print sales.
                          </span>
                        </div>
                      )}
                    </>
                  ) : imageUrl ? (
                    <p className={styles.printInfoTextMuted}>Loading image info...</p>
                  ) : (
                    <p className={styles.printInfoTextMuted}>
                      Upload an image to check print eligibility.
                    </p>
                  )}

                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <Button
                      font="dashboard"
                      variant="primary"
                      label="More info on print sizes"
                      onClick={() => setShowPrintInfoModal(true)}
                      type="button"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className={dashboardStyles.hint}>
            Accepted: JPG, PNG, WebP, GIF (max 1MB). Minimum resolution: {MIN_ARTWORK_IMAGE_WIDTH} ×{' '}
            {MIN_ARTWORK_IMAGE_HEIGHT} px. Print masters live in The Print Space — only the web
            preview is uploaded here. Images are automatically optimized for the web.
          </span>
        </div>
      )}

      {/* Print Sales — right after the image uploader, image artworks only */}
      {formData.artworkType === 'image' && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Print Sales</h3>
          <p className={dashboardStyles.sectionDescription}>
            Let buyers order a physical print of this artwork. We&apos;ll show a &quot;Buy
            Printable&quot; button next to &quot;Inquire&quot; on the public page.
          </p>
          <Checkbox
            checked={formData.printEnabled}
            onChange={(e) => {
              if (printEligible || !e.target.checked) {
                onFormChange('printEnabled', e.target.checked)
              }
            }}
            label="Enable this artwork for print sales"
            disabled={!printEligible}
          />
          {!printEligible && (
            <p className={styles.printDisabledHint}>
              Upload an image with at least {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px to enable
              print sales.
            </p>
          )}
          <div
            className={dashboardStyles.field}
            style={{ maxWidth: 240, marginTop: 'var(--space-4)' }}
          >
            <label htmlFor="printPriceEuros">Your price per print (&euro;)</label>
            <Input
              id="printPriceEuros"
              type="text"
              size="medium"
              value={formData.printPriceEuros}
              onChange={(e) =>
                onFormChange('printPriceEuros', e.target.value.replace(/[^0-9.]/g, ''))
              }
              placeholder="100"
            />
          </div>
          <span className={dashboardStyles.hint}>
            This is the amount you earn per print sold. Production, shipping, gallery fee and VAT
            are added separately at checkout.
          </span>
        </div>
      )}

      {/* Per-artwork printing restrictions — separate section so the
          parent's hint break-out doesn't visually collide with this block. */}
      {formData.artworkType === 'image' && formData.printEnabled && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Printing restrictions</h3>
          <p className={dashboardStyles.sectionDescription}>
            Advanced — you don&apos;t need to touch this unless you have very specific reasons not
            to offer a particular paper, format, size or frame for this artwork.
          </p>

          <details className={styles.printRestrictions}>
            <summary className={styles.printRestrictionsSummary}>Show options</summary>

            <p className={styles.printRestrictionsIntro}>
              We already offer the best print quality we can — museum-grade papers, archival inks,
              and gallery-tested framing. The options listed below are the ones our printing service
              supports for this kind of artwork. Uncheck anything you&apos;d rather we not offer;
              everything that stays checked remains available to buyers.
            </p>

            <PrintRestrictionGroup
              title="Papers"
              all={PAPERS.map((p) => ({ id: p.id, label: p.label }))}
              dimensionKey="allowedPaperIds"
              options={formData.printOptions}
              onChange={onPrintOptionsChange}
              allIds={PAPERS.map((p) => p.id)}
            />
            <PrintRestrictionGroup
              title="Formats"
              all={FORMATS.map((f) => ({ id: f.id, label: f.label }))}
              dimensionKey="allowedFormatIds"
              options={formData.printOptions}
              onChange={onPrintOptionsChange}
              allIds={FORMATS.map((f) => f.id)}
            />
            <PrintRestrictionGroup
              title="Sizes"
              all={eligibleSizeOptions.map((s) => ({ id: s.id, label: s.label }))}
              dimensionKey="allowedSizeIds"
              options={formData.printOptions}
              onChange={onPrintOptionsChange}
              allIds={eligibleSizeOptions.map((s) => s.id)}
            />
            <PrintRestrictionGroup
              title="Frame colors"
              all={FRAME_COLORS.map((c) => ({ id: c.id, label: c.label }))}
              dimensionKey="allowedFrameColorIds"
              options={formData.printOptions}
              onChange={onPrintOptionsChange}
              allIds={FRAME_COLORS.map((c) => c.id)}
            />
            <PrintRestrictionGroup
              title="Mounts"
              all={MOUNTS.map((m) => ({ id: m.id, label: m.label }))}
              dimensionKey="allowedMountIds"
              options={formData.printOptions}
              onChange={onPrintOptionsChange}
              allIds={MOUNTS.map((m) => m.id)}
            />
          </details>
        </div>
      )}

      {/* Sound Upload Section - only for sound type */}
      {formData.artworkType === 'sound' && (
        <div className={`${dashboardStyles.section} ${styles.imageSectionHalf}`}>
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

      {/* Print sizes info modal */}
      {showPrintInfoModal && (
        <Modal onClose={() => setShowPrintInfoModal(false)}>
          <div className={styles.printModal}>
            <Text as="h3" font="dashboard" size="lg" weight="medium">
              Print Size Requirements
            </Text>
            <p className={styles.printModalDescription}>
              Each print size requires a minimum image resolution at 300 DPI. The table below shows
              the minimum pixel dimensions needed for each size we offer.
            </p>
            <table className={styles.printModalTable}>
              <thead>
                <tr>
                  <th>Print Size</th>
                  <th>Min. Resolution</th>
                  {imageMeta && <th>Your DPI</th>}
                  {imageMeta && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {printSizes.map((size) => (
                  <tr key={size.label}>
                    <td>{size.label}</td>
                    <td>
                      {size.requiredWidth} × {size.requiredHeight} px
                    </td>
                    {imageMeta && (
                      <td>
                        <span
                          className={size.eligible ? styles.statusReady : styles.statusNotReady}
                        >
                          {Math.min(size.effectiveDpiW, size.effectiveDpiH)} DPI
                        </span>
                      </td>
                    )}
                    {imageMeta && (
                      <td>
                        {size.eligible ? (
                          <span className={styles.statusReady}>
                            <Icon name="check-circle" size={14} /> Ready
                          </span>
                        ) : (
                          <span className={styles.statusNotReady}>
                            <Icon name="alert-circle" size={14} /> Too small
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {imageMeta && (
              <p className={styles.printModalCurrentRes}>
                Your image: {imageMeta.width} × {imageMeta.height} px
              </p>
            )}
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}
            >
              <Button
                font="dashboard"
                variant="primary"
                label="Got it"
                onClick={() => setShowPrintInfoModal(false)}
                type="button"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
