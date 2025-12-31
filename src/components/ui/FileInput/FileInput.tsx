'use client'

import c from 'classnames'
import { forwardRef } from 'react'
import type { ChangeEventHandler, FormEventHandler } from 'react'

import styles from './FileInput.module.scss'

type FileInputProps = {
  id: string
  accept?: string
  onInput?: FormEventHandler<HTMLInputElement>
  onChange?: ChangeEventHandler<HTMLInputElement>
  className?: string
}

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ id, accept = 'image/*', onInput, onChange, className }, ref) => {
    return (
      <input
        ref={ref}
        id={id}
        className={c(styles.input, className)}
        type="file"
        accept={accept}
        onInput={onInput}
        onChange={onChange}
      />
    )
  },
)

FileInput.displayName = 'FileInput'

export default FileInput
