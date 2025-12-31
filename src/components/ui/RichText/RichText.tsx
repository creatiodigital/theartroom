'use client'

import c from 'classnames'

import styles from './RichText.module.scss'

type RichTextProps = {
  content: string
  className?: string
}

export const RichText = ({ content, className }: RichTextProps) => {
  if (!content) return null

  return (
    <div
      className={c(styles.richText, className)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
