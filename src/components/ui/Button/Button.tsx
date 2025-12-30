'use client'

import React from 'react'

import c from 'classnames'

import type { MouseEventHandler } from 'react'

import styles from './Button.module.scss'

type ButtonProps = {
  variant?: 'primary' | 'outline' | 'small' | 'link'
  type?: 'submit' | 'button' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  label: string
  disabled?: boolean
  className?: string
}

export const Button = React.memo(
  ({ variant = 'primary', type = 'button', onClick, label, disabled, className }: ButtonProps) => {
    return (
      <button
        className={c([styles.button, styles[variant], disabled && styles.disabled, className])}
        onClick={onClick}
        type={type}
        disabled={disabled}
      >
        {label}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button
