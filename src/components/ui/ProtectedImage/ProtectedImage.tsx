'use client'

import Image, { type ImageProps } from 'next/image'

import { isSafeImageSrc } from '@/lib/imageSafety'

import styles from './ProtectedImage.module.scss'

/**
 * Image wrapper that prevents non-technical users from easily
 * downloading or saving images via right-click, drag, or long-press.
 *
 * Also guards against unconfigured image hostnames — if the URL
 * isn't in the allowed list, renders a placeholder instead of crashing.
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

  // Guard: don't pass unsafe URLs to next/image
  if (!isSafeImageSrc(props.src as string)) {
    return (
      <div
        className={`${wrapperStyle}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
        style={{ backgroundColor: 'var(--color-grey-100, #f0f0f0)' }}
      />
    )
  }

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
