'use client'

import c from 'classnames'
import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { FileInput } from '@/components/ui/FileInput'
import { Icon } from '@/components/ui/Icon'
import Modal from '@/components/ui/Modal/Modal'
import { Text } from '@/components/ui/Typography'
import { Tooltip } from '@/components/ui/Tooltip'
import { addPendingUpload } from '@/lib/pendingUploads'
import { editArtisticImage } from '@/redux/slices/artworkSlice'
import { chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import styles from './ArtisticImage.module.scss'

type ArtisticImageProps = {
  artwork: TArtwork
}

const MAX_FILE_SIZE_MB = 1
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const ArtisticImage = ({ artwork }: ArtisticImageProps) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  })
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  const {
    showFrame,
    frameColor,
    frameSize,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
  } = artwork

  const handleDoubleClick = () => {
    fileInputRef.current?.click()
  }

  const showError = (message: string) => {
    setErrorModal({ show: true, message })
  }

  const closeErrorModal = () => {
    setErrorModal({ show: false, message: '' })
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validation = validateFile(file)
    if (validation.valid) {
      processFile(file)
    } else {
      showError(validation.error!)
    }
    // Reset input so user can select same file again after fixing
    event.target.value = ''
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const file = event.dataTransfer.files[0]

    if (currentArtworkId !== artwork.id) {
      dispatch(chooseCurrentArtworkId(artwork.id))
    }

    if (!file) return

    const validation = validateFile(file)
    if (validation.valid) {
      processFile(file)
    } else {
      showError(validation.error!)
    }
  }

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'Only JPG, PNG, WebP, or GIF files are allowed.' }
    }

    // Check file size (1MB max)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      return {
        valid: false,
        error: `Image is too large (${fileSizeMB}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please compress or resize your image before uploading.`,
      }
    }

    return { valid: true }
  }

  const processFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file)

    // Load image to get original dimensions
    const img = new Image()
    img.onload = () => {
      const originalWidth = img.naturalWidth
      const originalHeight = img.naturalHeight

      // Store the File object with dimensions for later upload on Save
      addPendingUpload(artwork.id, file, fileUrl, originalWidth, originalHeight)

      // Update Redux for instant preview
      dispatch(
        editArtisticImage({
          currentArtworkId: artwork.id,
          property: 'imageUrl',
          value: fileUrl,
        }),
      )
    }
    img.src = fileUrl
  }

  return (
    <>
      <div
        className={`${styles.frame} ${isDragOver ? styles.dragOver : ''}`}
        style={{
          border:
            showFrame && imageUrl
              ? `${frameSize?.value ?? 3}px solid ${frameColor ?? '#000000'}`
              : undefined,
        }}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={styles.passepartout}
          style={{
            border:
              showPassepartout && imageUrl && passepartoutSize
                ? `${passepartoutSize.value}px solid ${passepartoutColor}`
                : undefined,
          }}
        >
          <div
            className={styles.image}
            style={{
              backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
            }}
          >
            {!imageUrl && (
              <div className={c([styles.empty, { [styles.over]: isDragOver }])}>
                <Tooltip
                  label="Drag and drop an image or double-click. Size should not exceed 1MB."
                  placement="top"
                >
                  <span style={{ display: 'inline-flex' }}>
                    <Icon name="image" size={40} color={isDragOver ? '#ffffff' : '#000000'} />
                  </span>
                </Tooltip>
              </div>
            )}
            <FileInput
              ref={fileInputRef}
              id={`file-upload-${currentArtworkId}`}
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {errorModal.show && (
        <Modal onClose={closeErrorModal}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Text as="h3" font="dashboard" size="lg" weight="medium">
              Image Too Large
            </Text>
            <Text as="p" font="dashboard" size="sm">
              {errorModal.message}
            </Text>
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}
            >
              <Button font="dashboard" variant="primary" label="OK" onClick={closeErrorModal} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

export default ArtisticImage
