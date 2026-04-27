'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MAX_UPLOAD_SIZE, MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT } from '@/lib/imageConfig'

import styles from './ImageUploader.module.scss'

type ImageMeta = {
  width: number
  height: number
  format: string
  sizeBytes: number
  dpi?: number | null
}

export type { ImageMeta }

type ImageUploaderProps = {
  imageUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onRemove?: () => void | Promise<void>
  onMetaChange?: (meta: ImageMeta | null) => void
  displayMeta?: ImageMeta | null
  uploading?: boolean
  loadingText?: string
  aspectRatio?: string
  objectFit?: 'cover' | 'contain'
  placeholder?: string
  maxSizeBytes?: number
  minWidth?: number
  minHeight?: number
  /**
   * When true, the preview/dropzone ignores aspectRatio and stretches to
   * fill whatever vertical space its parent gives it (via flex-grow).
   * Use from layouts where two uploaders need to visually match height
   * regardless of their parents' description lengths.
   */
  fill?: boolean
  /**
   * External error (e.g. from a failed server-side upload). Rendered
   * inline right below the dropzone in the same style as the built-in
   * size/resolution errors, so users see feedback where they are.
   */
  error?: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// Whitelist of MIME types both print providers accept. The Print Space
// only takes JPEG, PNG and TIFF; Prodigi accepts a superset, so this is
// the safe intersection.
const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/tiff'])

const ACCEPT_ATTR = 'image/jpeg,image/png,image/tiff'

function formatFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/tiff': 'TIFF',
  }
  return map[mime] || mime.replace('image/', '').toUpperCase()
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = src
  })
}

export const ImageUploader = ({
  imageUrl,
  onUpload,
  onRemove,
  onMetaChange,
  displayMeta,
  uploading = false,
  loadingText = 'Uploading...',
  aspectRatio = '16 / 10',
  objectFit = 'cover',
  placeholder: _placeholder = 'No image',
  maxSizeBytes = MAX_UPLOAD_SIZE,
  minWidth = MIN_IMAGE_WIDTH,
  minHeight = MIN_IMAGE_HEIGHT,
  fill = false,
  error,
}: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [resolutionError, setResolutionError] = useState<string | null>(null)
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null)

  // Load metadata for existing images (from URL)
  useEffect(() => {
    if (!imageUrl) {
      setImageMeta(null)
      onMetaChange?.(null)
      return
    }

    // Skip blob URLs — metadata for those is set during upload
    if (imageUrl.startsWith('blob:')) return

    getImageDimensions(imageUrl).then(({ width, height }) => {
      if (width === 0 || height === 0) {
        setImageMeta(null)
        onMetaChange?.(null)
        return
      }
      const meta = { width, height, format: 'WebP', sizeBytes: 0 }
      setImageMeta(meta)
      onMetaChange?.(meta)
    })
  }, [imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const validateFile = useCallback(
    async (file: File): Promise<boolean> => {
      setSizeError(null)
      setResolutionError(null)

      // Check MIME type. The browser's `accept` attribute is a hint, not
      // a hard gate — drag-and-drop bypasses it entirely. Reject anything
      // outside the print-provider intersection here too.
      if (file.type && !ACCEPTED_MIME_TYPES.has(file.type)) {
        setSizeError('Invalid file type. Accepted: JPG, PNG, TIFF.')
        return false
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
        const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0)
        setSizeError(`File is too large (${sizeMB}MB). Maximum size is ${maxMB}MB.`)
        return false
      }

      // Check resolution
      const url = URL.createObjectURL(file)
      try {
        const { width, height } = await getImageDimensions(url)
        if (minWidth > 0 && minHeight > 0 && (width < minWidth || height < minHeight)) {
          setResolutionError(
            `Image is too small (${width} × ${height} px). Minimum resolution is ${minWidth} × ${minHeight} px.`,
          )
          return false
        }
        const meta = {
          width,
          height,
          format: formatFromMime(file.type),
          sizeBytes: file.size,
        }
        setImageMeta(meta)
        onMetaChange?.(meta)
      } finally {
        URL.revokeObjectURL(url)
      }

      return true
    },
    [maxSizeBytes, minWidth, minHeight, onMetaChange],
  )

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        const valid = await validateFile(file)
        if (!valid) {
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }
        await onUpload(file)
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [onUpload, validateFile],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const file = e.dataTransfer.files?.[0]
      if (file && file.type.startsWith('image/')) {
        const valid = await validateFile(file)
        if (!valid) return
        await onUpload(file)
      }
    },
    [onUpload, validateFile],
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onRemove) {
        await onRemove()
        setImageMeta(null)
        onMetaChange?.(null)
      }
    },
    [onRemove, onMetaChange],
  )

  // When `fill` is set, drop the aspect-ratio constraint and rely on
  // the parent flex container to dictate height. A min-height keeps the
  // dropzone usable even if the parent collapses to a small size.
  const boxStyle = fill ? ({ flex: 1, minHeight: 220 } as const) : ({ aspectRatio } as const)
  const containerClass = fill ? `${styles.container} ${styles.containerFill}` : styles.container

  return (
    <div className={containerClass}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleFileSelect}
        className={styles.hiddenInput}
      />

      {imageUrl ? (
        // Image preview state
        <div className={styles.preview} style={boxStyle}>
          <Image src={imageUrl} alt="Uploaded image" fill style={{ objectFit }} />
          {onRemove && (
            <button
              type="button"
              className={styles.removeButton}
              onClick={handleRemove}
              disabled={uploading}
              aria-label="Remove image"
            >
              <Icon name="close" size={16} />
            </button>
          )}
          {uploading && (
            <div className={styles.uploadingOverlay}>
              <span>{loadingText}</span>
            </div>
          )}
        </div>
      ) : (
        // Dropzone state
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
          style={boxStyle}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
          {uploading ? (
            <span className={styles.uploadingText}>{loadingText}</span>
          ) : (
            <>
              <Button
                font="dashboard"
                variant="primary"
                label="Select a File"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick()
                }}
                type="button"
              />
              <span className={styles.dropText}>or drag and drop files</span>
            </>
          )}
        </div>
      )}

      {/* Image metadata — prefer displayMeta (server-known original) over internal CDN meta */}
      {(() => {
        const meta = displayMeta ?? imageMeta
        if (!meta || !imageUrl || meta.width <= 0) return null
        return (
          <div className={styles.imageMeta}>
            {displayMeta && <span className={styles.imageMetaLabel}>Original file:</span>}
            <span>
              {meta.width} × {meta.height} px
            </span>
            <span>{meta.format}</span>
            {meta.sizeBytes > 0 && <span>{formatFileSize(meta.sizeBytes)}</span>}
          </div>
        )
      })()}

      {sizeError && <div className={styles.sizeError}>{sizeError}</div>}
      {resolutionError && <div className={styles.sizeError}>{resolutionError}</div>}
      {error && <div className={styles.sizeError}>{error}</div>}
    </div>
  )
}

export default ImageUploader
