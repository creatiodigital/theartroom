'use client'

import { useRef, useState, useCallback } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import Image from 'next/image'

import { Button } from '@/components/ui/Button'

import styles from './ImageUploader.module.scss'

type ImageUploaderProps = {
  imageUrl?: string | null
  onUpload: (file: File) => Promise<void>
  onRemove?: () => Promise<void>
  uploading?: boolean
  aspectRatio?: string
  objectFit?: 'cover' | 'contain'
  placeholder?: string
}

export const ImageUploader = ({
  imageUrl,
  onUpload,
  onRemove,
  uploading = false,
  aspectRatio = '16 / 10',
  objectFit = 'cover',
  placeholder = 'No image',
}: ImageUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await onUpload(file)
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [onUpload],
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
        await onUpload(file)
      }
    },
    [onUpload],
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
              <span>Uploading...</span>
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
            <span className={styles.uploadingText}>Uploading...</span>
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
    </div>
  )
}

export default ImageUploader
