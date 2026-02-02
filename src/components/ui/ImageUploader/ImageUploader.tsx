'use client'

import { useRef, useState, useCallback } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'
import { MAX_UPLOAD_SIZE } from '@/lib/imageConfig'

import styles from './ImageUploader.module.scss'

type ImageUploaderProps = {
  imageUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onRemove?: () => void | Promise<void>
  uploading?: boolean
  loadingText?: string
  aspectRatio?: string
  objectFit?: 'cover' | 'contain'
  placeholder?: string
  maxSizeBytes?: number
}

export const ImageUploader = ({
  imageUrl,
  onUpload,
  onRemove,
  uploading = false,
  loadingText = 'Uploading...',
  aspectRatio = '16 / 10',
  objectFit = 'cover',
  placeholder = 'No image',
  maxSizeBytes = MAX_UPLOAD_SIZE,
}: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)

  const validateFileSize = useCallback(
    (file: File): boolean => {
      if (file.size > maxSizeBytes) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2)
        const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(0)
        setSizeError(`File is too large (${sizeMB}MB). Maximum size is ${maxMB}MB.`)
        return false
      }
      setSizeError(null)
      return true
    },
    [maxSizeBytes],
  )


  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        if (!validateFileSize(file)) {
          // Reset input so same file can be selected again
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          return
        }
        await onUpload(file)
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [onUpload, validateFileSize],
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
        if (!validateFileSize(file)) {
          return
        }
        await onUpload(file)
      }
    },
    [onUpload, validateFileSize],
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRemove = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onRemove) {
        await onRemove()
      }
    },
    [onRemove],
  )

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className={styles.hiddenInput}
      />

      {imageUrl ? (
        // Image preview state
        <div className={styles.preview} style={{ aspectRatio }}>
          <Image
            src={imageUrl}
            alt="Uploaded image"
            fill
            style={{ objectFit }}
          />
          {onRemove && (
            <button
              type="button"
              className={styles.removeButton}
              onClick={handleRemove}
              disabled={uploading}
              aria-label="Remove image"
            >
              ×
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
          style={{ aspectRatio }}
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

      {sizeError && (
        <div className={styles.sizeError}>{sizeError}</div>
      )}
    </div>
  )
}

export default ImageUploader

