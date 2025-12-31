'use client'

import React from 'react'
import Link from 'next/link'

import c from 'classnames'

import type { MouseEventHandler, ReactNode } from 'react'

import styles from './Button.module.scss'

type ButtonProps = {
  variant?: 'primary' | 'outline' | 'small' | 'link'
  type?: 'submit' | 'button' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  label: string
  disabled?: boolean
  className?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
  href?: string
}

export const Button = React.memo(
  ({
    variant = 'primary',
    type = 'button',
    onClick,
    label,
    disabled,
    className,
    iconLeft,
    iconRight,
    href,
  }: ButtonProps) => {
    const classNames = c([styles.button, styles[variant], disabled && styles.disabled, className])

    const content = (
      <>
        {iconLeft && <span className={styles.iconLeft}>{iconLeft}</span>}
        {label}
        {iconRight && <span className={styles.iconRight}>{iconRight}</span>}
      </>
    )

    // Render as Link if href is provided
    if (href) {
      return (
        <Link href={href} className={classNames}>
          {content}
        </Link>
      )
    }

    return (
      <button className={classNames} onClick={onClick} type={type} disabled={disabled}>
        {content}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button
