'use client'

import React from 'react'
import Link from 'next/link'

import c from 'classnames'

import { Icon, type IconName } from '@/components/ui/Icon'
import type { MouseEventHandler, ReactNode } from 'react'

import styles from './Button.module.scss'

type ButtonProps = {
  variant?: 'primary' | 'outline' | 'link'
  size?: 'tiny' | 'small' | 'regular' | 'big'
  fontFamily?: 'serif' | 'sans'
  type?: 'submit' | 'button' | 'reset'
  onClick?: MouseEventHandler<HTMLButtonElement>
  label?: string
  icon?: IconName
  disabled?: boolean
  className?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
  href?: string
  title?: string
  draggable?: boolean
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void
}

export const Button = React.memo(
  ({
    variant = 'primary',
    size = 'regular',
    fontFamily = 'sans',
    type = 'button',
    onClick,
    label,
    icon,
    disabled,
    className,
    iconLeft,
    iconRight,
    href,
    title,
    draggable,
    onDragStart,
  }: ButtonProps) => {
    const isIconOnly = icon && !label
    
    const classNames = c([
      styles.button,
      styles[variant],
      styles[size],
      styles[fontFamily],
      isIconOnly && styles.iconOnly,
      disabled && styles.disabled,
      className,
    ])

    const iconSize = size === 'big' ? 24 : size === 'tiny' ? 16 : size === 'small' ? 18 : 20

    const content = (
      <>
        {iconLeft && <span className={styles.iconLeft}>{iconLeft}</span>}
        {icon && <Icon name={icon} size={iconSize} color="currentColor" />}
        {label}
        {iconRight && <span className={styles.iconRight}>{iconRight}</span>}
      </>
    )

    // Render as Link if href is provided
    if (href) {
      return (
        <Link href={href} className={classNames} title={title}>
          {content}
        </Link>
      )
    }

    return (
      <button
        className={classNames}
        onClick={onClick}
        type={type}
        disabled={disabled}
        title={title}
        draggable={draggable}
        onDragStart={onDragStart}
      >
        {content}
      </button>
    )
  },
)

Button.displayName = 'Button'

export default Button

