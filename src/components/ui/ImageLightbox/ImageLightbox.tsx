'use client'

import { useEffect, useCallback } from 'react'

import styles from './ImageLightbox.module.scss'

type ImageLightboxProps = {
  imageUrl: string
  alt: string
  caption?: string
  onClose: () => void
}

/**
 * Full-screen lightbox for viewing high-resolution images.
 * Closes on backdrop click or Escape key.
 */
export const ImageLightbox = ({ imageUrl, alt, caption, onClose }: ImageLightboxProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <button className={styles.closeButton} onClick={onClose} aria-label="Close lightbox">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img src={imageUrl} alt={alt} className={styles.image} />
      {caption && <p className={styles.caption}>{caption}</p>}
    </div>
  )
}
