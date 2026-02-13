'use client'

import c from 'classnames'
import { useState } from 'react'
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
  autoComplete?: string
  placeholder?: string
  required?: boolean
  id?: string
  className?: string
  showPasswordToggle?: boolean
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
  autoComplete,
  placeholder,
  required,
  id,
  className,
  showPasswordToggle = false,
}: TInput) => {
  const [showPassword, setShowPassword] = useState(false)

  // Determine actual input type based on password visibility
  const inputType = type === 'password' && showPassword ? 'text' : type

  return (
    <div className={c(styles.wrapper, className)}>
      <input
        id={id}
        type={inputType}
        className={c([
          styles.input,
          styles[size],
          variant && styles[variant],
          { [styles.withIcon]: !!icon },
          { [styles.withToggle]: type === 'password' && showPasswordToggle },
        ])}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
      />
      {icon && (
        <div className={c(styles.icon, { [styles[`rotate${rotate}` as string]]: !!rotate })}>
          <Icon name={icon} size={16} color="#444444" />
        </div>
      )}
      {type === 'password' && showPasswordToggle && (
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} color="#666666" />
        </button>
      )}
    </div>
  )
}

export default Input
