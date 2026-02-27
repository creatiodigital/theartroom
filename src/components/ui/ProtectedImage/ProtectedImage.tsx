'use client'

import Image, { type ImageProps } from 'next/image'

import styles from './ProtectedImage.module.scss'

/**
 * Image wrapper that prevents non-technical users from easily
 * downloading or saving images via right-click, drag, or long-press.
 *
 * Layered defenses:
 * - CSS overlay intercepts pointer events (blocks "Save Image As")
 * - Disables right-click context menu on the wrapper
 * - Disables drag-and-drop (draggable=false + onDragStart prevention)
 * - Disables text selection and iOS long-press save
 * - pointer-events: none on the <img> itself
 *
 * Accepts the same props as next/image.
 */
type ProtectedImageProps = ImageProps & {
  /** Optional extra className applied to the wrapper div */
  wrapperClassName?: string
}

export const ProtectedImage = ({
  wrapperClassName,
  fill,
  className,
  ...props
}: ProtectedImageProps) => {
  const wrapperStyle = fill ? styles.fill : styles.wrapper

  return (
    <div
      className={`${wrapperStyle}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <Image {...props} fill={fill} className={className} draggable={false} />
    </div>
  )
}
