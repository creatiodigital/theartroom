'use client'

import c from 'classnames'
import type { ChangeEventHandler } from 'react'

import styles from './Textarea.module.scss'

type TTextarea = {
  id?: string
  value: string
  onChange: ChangeEventHandler<HTMLTextAreaElement>
  placeholder?: string
  rows?: number
  size?: 'regular' | 'medium'
  className?: string
}

function Textarea({ id, value, onChange, placeholder, rows = 3, size = 'regular', className }: TTextarea) {
  return (
    <div className={c(styles.wrapper, className)}>
      <textarea
        id={id}
        className={c(styles.textarea, styles[size])}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  )
}

export default Textarea
