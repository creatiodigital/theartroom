'use client'

import { useRef } from 'react'
import type { ReactNode, MouseEvent } from 'react'

type ModalProps = {
  children: ReactNode
  onClose: () => void
}

import styles from './Modal.module.scss'

const Modal = ({ children, onClose }: ModalProps) => {
  const mouseDownOnBackdrop = useRef(false)

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Only mark if the mousedown was directly on the backdrop (not a child)
    mouseDownOnBackdrop.current = e.target === e.currentTarget
  }

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    // Close only if BOTH mousedown and mouseup happened on the backdrop
    if (mouseDownOnBackdrop.current && e.target === e.currentTarget) {
      onClose()
    }
    mouseDownOnBackdrop.current = false
  }

  return (
    <div
      className={styles.modal}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      data-no-deselect="true"
    >
      <div
        className={styles.content}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default Modal
