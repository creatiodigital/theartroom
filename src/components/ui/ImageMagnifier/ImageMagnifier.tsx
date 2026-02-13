'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  zoomLevel = 2.5,
}: ImageMagnifierProps) => {
  const [isMobile, setIsMobile] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 })
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [expandedSize, setExpandedSize] = useState({ width: 0, height: 0 })
  const [aspectRatio, setAspectRatio] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Calculate expanded container size
  const calculateExpandedSize = useCallback(() => {
    if (!imageRef.current || !wrapperRef.current) return

    const imgWidth = imageRef.current.offsetWidth
    const imgHeight = imageRef.current.offsetHeight
    const ratio = imgWidth / imgHeight

    // Get available width from the image container area
    const viewportWidth = window.innerWidth
    const maxWidth = Math.min(viewportWidth * 0.55, 800)

    setAspectRatio(ratio)
    setExpandedSize({
      width: Math.max(imgWidth, maxWidth),
      height: imgHeight,
    })
    setImageDimensions({ width: imgWidth, height: imgHeight })
  }, [])

  const handleImageLoad = useCallback(() => {
    calculateExpandedSize()
  }, [calculateExpandedSize])

  useEffect(() => {
    window.addEventListener('resize', calculateExpandedSize)
    return () => window.removeEventListener('resize', calculateExpandedSize)
  }, [calculateExpandedSize])

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || !isHovering) return

      const rect = containerRef.current.getBoundingClientRect()

      const xPercent = (e.clientX - rect.left) / rect.width
      const yPercent = (e.clientY - rect.top) / rect.height

      // Calculate zoomed image size preserving aspect ratio
      const zoomedWidth = expandedSize.width * zoomLevel
      const zoomedHeight = zoomedWidth / aspectRatio // Maintain aspect ratio

      const offsetX = -(xPercent * (zoomedWidth - expandedSize.width))
      const offsetY = -(yPercent * (zoomedHeight - expandedSize.height))

      setZoomPosition({ x: offsetX, y: offsetY })
    },
    [isHovering, expandedSize, zoomLevel, aspectRatio],
  )

  const zoomedSrc = highResSrc || src

  // Calculate zoomed image dimensions preserving aspect ratio
  const zoomedWidth = expandedSize.width * zoomLevel
  const zoomedHeight = zoomedWidth / aspectRatio

  // On mobile, just render a simple image without zoom functionality
  if (isMobile) {
    return (
      <div className={`${styles.wrapper} ${className}`}>
        <img src={src} alt={alt} className={styles.image} />
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className}`}>
      {/* Normal image - hidden when hovering */}
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className={`${styles.image} ${isHovering ? styles.hidden : ''}`}
        onLoad={handleImageLoad}
      />

      {/* Expanded zoom container - appears on hover */}
      <div
        ref={containerRef}
        className={`${styles.zoomContainer} ${isHovering ? styles.visible : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        style={{
          width: isHovering ? `${expandedSize.width}px` : `${imageDimensions.width}px`,
          height: isHovering ? `${expandedSize.height}px` : `${imageDimensions.height}px`,
        }}
      >
        {isHovering && (
          <img
            src={zoomedSrc}
            alt=""
            className={styles.zoomImg}
            style={{
              width: `${zoomedWidth}px`,
              height: `${zoomedHeight}px`,
              top: `${zoomPosition.y}px`,
              left: `${zoomPosition.x}px`,
            }}
          />
        )}
      </div>

      {/* Invisible trigger area over the image */}
      {!isHovering && <div className={styles.trigger} onMouseEnter={handleMouseEnter} />}
    </div>
  )
}
