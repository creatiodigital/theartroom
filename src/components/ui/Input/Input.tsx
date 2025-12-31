'use client'

import c from 'classnames'
import type { ChangeEventHandler, FocusEventHandler, KeyboardEventHandler } from 'react'

import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/components/ui/Icon'

import styles from './Input.module.scss'

type TInput = {
  variant?: string
  size?: 'regular' | 'medium'
  type?: 'text' | 'password' | 'email'
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  icon?: IconName
  rotate?: number
  onBlur?: FocusEventHandler<HTMLInputElement>
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  autoFocus?: boolean
  placeholder?: string
  required?: boolean
  id?: string
  className?: string
}

const Input = ({
  variant,
  size = 'regular',
  type = 'text',
  value,
  onChange,
  icon,
  rotate,
  onBlur,
  onKeyDown,
  autoFocus = false,
  placeholder,
  required,
  id,
  className,
}: TInput) => {
  return (
    <div className={c(styles.wrapper, className)}>
      <input
        id={id}
        type={type}
        className={c([
          styles.input,
          styles[size],
          variant && styles[variant],
          { [styles.withIcon]: !!icon },
        ])}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        required={required}
      />
      {icon && (
        <div className={c(styles.icon, { [styles[`rotate${rotate}` as string]]: !!rotate })}>
          <Icon name={icon} size={16} color="#444444" />
        </div>
      )}
    </div>
  )
}

export default Input
