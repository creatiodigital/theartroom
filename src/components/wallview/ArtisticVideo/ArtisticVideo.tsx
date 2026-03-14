'use client'

import c from 'classnames'
import { useRef, useState, useEffect } from 'react'
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

import { WALL_SCALE } from '@/components/wallview/constants'

import styles from './ArtisticVideo.module.scss'

type ArtisticVideoProps = {
  artwork: TArtwork
}

const MAX_IMAGE_SIZE_MB = 1
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
const MAX_VIDEO_SIZE_MB = 50
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const allowedVideoTypes = ['video/mp4', 'video/webm']

const ArtisticVideo = ({ artwork }: ArtisticVideoProps) => {
  const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)

  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const dispatch = useDispatch()
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string; title: string }>({
    show: false,
    message: '',
    title: '',
  })

  const {
    showFrame,
    frameColor,
    frameSize,
    frameMaterial,
    frameTextureScale,
    frameTextureRotation,
    imageUrl,
    showPassepartout,
    passepartoutColor,
    passepartoutSize,
    videoUrl,
  } = artwork

  // Extract first frame from video when no poster image exists
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null)
  useEffect(() => {
    if (imageUrl || !videoUrl) {
      setVideoFrameUrl(null)
      return
    }

    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = videoUrl

    const handleLoadedData = () => { video.currentTime = 0 }
    const handleSeeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        setVideoFrameUrl(canvas.toDataURL('image/jpeg', 0.7))
      }
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('seeked', handleSeeked)
      video.removeAttribute('src')
      video.load()
    }
  }, [imageUrl, videoUrl])

  // The display image: poster → video first frame → none
  const displayImageUrl = imageUrl || videoFrameUrl

  const handleDoubleClick = () => {
    // If no poster image yet, open image picker first
    if (!imageUrl) {
      imageInputRef.current?.click()
    } else if (!videoUrl) {
      // If poster exists but no video, open video picker
      videoInputRef.current?.click()
    } else {
      // Both exist, open image picker to replace poster
      imageInputRef.current?.click()
    }
  }

  const showError = (title: string, message: string) => {
    setErrorModal({ show: true, title, message })
  }

  const closeErrorModal = () => {
    setErrorModal({ show: false, message: '', title: '' })
  }

  // --- Image (poster) handling ---
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!allowedImageTypes.includes(file.type)) {
      showError('Invalid File', 'Only JPG, PNG, WebP, or GIF files are allowed for the poster image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      showError(
        'Image Too Large',
        `Poster image is too large (${fileSizeMB}MB). Maximum size is ${MAX_IMAGE_SIZE_MB}MB. Please compress or resize your image before uploading.`,
      )
      event.target.value = ''
      return
    }

    processImageFile(file)
    event.target.value = ''
  }

  const processImageFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file)

    const img = new Image()
    img.onload = () => {
      const originalWidth = img.naturalWidth
      const originalHeight = img.naturalHeight

      addPendingUpload(artwork.id, file, fileUrl, originalWidth, originalHeight)

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

  const processVideoFile = (file: File) => {
    const fileUrl = URL.createObjectURL(file)
    addPendingUpload(`${artwork.id}_video`, file, fileUrl, 0, 0)
    dispatch(
      editArtisticImage({
        currentArtworkId: artwork.id,
        property: 'videoUrl',
        value: fileUrl,
      }),
    )
  }

  // --- Video file handling ---
  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!allowedVideoTypes.includes(file.type)) {
      showError('Invalid File', 'Only MP4 or WebM video files are allowed.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      showError(
        'Video Too Large',
        `Video is too large (${fileSizeMB}MB). Maximum size is ${MAX_VIDEO_SIZE_MB}MB.`,
      )
      event.target.value = ''
      return
    }

    processVideoFile(file)
    event.target.value = ''
  }

  // --- Drag and drop ---
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

    // Check if it's an image or video
    if (allowedImageTypes.includes(file.type)) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
        showError(
          'Image Too Large',
          `Poster image is too large (${fileSizeMB}MB). Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`,
        )
        return
      }
      processImageFile(file)
    } else if (allowedVideoTypes.includes(file.type)) {
      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
        showError(
          'Video Too Large',
          `Video is too large (${fileSizeMB}MB). Maximum size is ${MAX_VIDEO_SIZE_MB}MB.`,
        )
        return
      }

      processVideoFile(file)
    } else {
      showError('Invalid File', 'Drop an image (JPG, PNG, WebP, GIF) or a video (MP4, WebM).')
    }
  }

  return (
    <>
      <div
        className={`${styles.frame} ${isDragOver ? styles.dragOver : ''}`}
        style={{
          ...(showFrame && displayImageUrl && (frameMaterial ?? 'plastic') === 'plastic'
            ? {
                border: `${(frameSize?.value ?? 3) * (WALL_SCALE / 100)}px solid ${frameColor ?? '#000000'}`,
              }
            : showFrame && displayImageUrl && frameMaterial?.startsWith('wood')
              ? {
                  padding: `${(frameSize?.value ?? 3) * (WALL_SCALE / 100)}px`,
                  position: 'relative' as const,
                  overflow: 'hidden' as const,
                }
              : {}),
        }}
        onDoubleClick={handleDoubleClick}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Wood frame backdrop */}
        {showFrame && displayImageUrl && frameMaterial?.startsWith('wood') && (
          <>
            <div
              style={{
                position: 'absolute',
                inset: '-50%',
                width: '200%',
                height: '200%',
                backgroundImage: `url('/assets/materials/wooden-frame-${(frameMaterial === 'wood' ? 'wood-dark' : (frameMaterial ?? 'wood-dark')).replace('wood-', '')}/diffuse.jpg')`,
                backgroundSize: `${(frameTextureScale ?? 2) * 25}%`,
                backgroundPosition: '50% 50%',
                backgroundRepeat: 'repeat',
                transform: `rotate(${frameTextureRotation ?? 0}deg)`,
                transformOrigin: 'center center',
                zIndex: 0,
                pointerEvents: 'none' as const,
              }}
            />
            {frameColor && frameColor !== '#ffffff' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: frameColor,
                  opacity: 0.75,
                  zIndex: 0,
                  pointerEvents: 'none' as const,
                }}
              />
            )}
          </>
        )}
        <div
          className={styles.passepartout}
          style={{
            border:
              showPassepartout && displayImageUrl && passepartoutSize
                ? `${passepartoutSize.value * (WALL_SCALE / 100)}px solid ${passepartoutColor}`
                : undefined,
            ...(showFrame && frameMaterial?.startsWith('wood')
              ? { position: 'relative' as const, zIndex: 1 }
              : {}),
          }}
        >
          <div
            className={styles.image}
            style={{
              backgroundImage: displayImageUrl ? `url(${displayImageUrl})` : 'none',
            }}
          >
            {!displayImageUrl && (
              <div className={c([styles.empty, { [styles.over]: isDragOver }])}>
                <Tooltip
                  label="Drag and drop an image or video, or double-click. Poster image max 1MB, video max 20MB."
                  placement="top"
                >
                  <span style={{ display: 'inline-flex' }}>
                    <Icon name="video" size={40} color={isDragOver ? '#ffffff' : '#000000'} />
                  </span>
                </Tooltip>
              </div>
            )}
            <FileInput
              ref={imageInputRef}
              id={`image-upload-${artwork.id}`}
              onChange={handleImageFileChange}
            />
            <FileInput
              ref={videoInputRef}
              id={`video-upload-${artwork.id}`}
              onChange={handleVideoFileChange}
            />
          </div>
        </div>

        {/* Video indicator badge */}
        {displayImageUrl && (
          <div className={styles.videoIndicator}>
            <Icon name="video" size={14} color="#ffffff" />
          </div>
        )}
      </div>

      {errorModal.show && (
        <Modal onClose={closeErrorModal}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Text as="h3" font="dashboard" size="lg" weight="medium">
              {errorModal.title}
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

export default ArtisticVideo
