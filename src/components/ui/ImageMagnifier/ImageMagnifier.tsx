'use client'

import { useState, useRef, useCallback } from 'react'
import styles from './ImageMagnifier.module.scss'

interface ImageMagnifierProps {
  src: string
  highResSrc?: string
  alt: string
  className?: string
  zoomLevel?: number
}

export const ImageMagnifier = ({
  src,
  highResSrc,
  alt,
  className = '',
  zoomLevel = 1.75,
}: ImageMagnifierProps) => {
  const [isHovering, setIsHovering] = useState(false)
  const [imagePosition, setImagePosition] = useState({ x: 50, y: 50 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    setImagePosition({ x: 50, y: 50 })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      
      // Get cursor position as percentage (0-100)
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100

      // Set image position (moves opposite to cursor)
      setImagePosition({ x: xPercent, y: yPercent })
    },
    []
  )

  const zoomedSrc = highResSrc || src

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Normal resolution image */}
      <img
        src={src}
        alt={alt}
        className={`${styles.image} ${isHovering ? styles.hidden : ''}`}
      />

      {/* High resolution zoomed image */}
      <div
        className={`${styles.zoomedWrapper} ${isHovering ? styles.visible : ''}`}
        style={{
          backgroundImage: `url(${zoomedSrc})`,
          backgroundPosition: `${imagePosition.x}% ${imagePosition.y}%`,
          backgroundSize: `${zoomLevel * 100}%`,
        }}
      />
    </div>
  )
}
