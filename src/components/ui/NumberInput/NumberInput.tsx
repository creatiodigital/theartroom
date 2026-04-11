'use client'

import { useState, useEffect, useCallback } from 'react'
import c from 'classnames'

import { Icon, type IconName } from '@/components/ui/Icon'

import styles from './NumberInput.module.scss'

type NumberInputProps = {
  variant?: string
  value: number
  onChange: React.ChangeEventHandler<HTMLInputElement>
  icon?: IconName
  rotate?: number
  max?: number
  min?: number
  label?: string
  disabled?: boolean
}

const NumberInput = ({
  variant,
  value,
  onChange,
  icon,
  rotate,
  _max,
  min,
  label,
  disabled,
}: NumberInputProps) => {
  // Track the display value as a string to allow empty state and proper editing
  const [displayValue, setDisplayValue] = useState<string>(String(value))
  const [isFocused, setIsFocused] = useState(false)

  // Sync display value with prop when not focused (external updates)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(String(value))
    }
  }, [value, isFocused])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value

      // Convert comma to dot for decimal separator (support European input)
      rawValue = rawValue.replace(',', '.')

      // Allow empty string for clearing
      if (rawValue === '' || rawValue === '-') {
        setDisplayValue(rawValue)
        return
      }

      // Only allow valid number characters
      if (!/^-?\d*\.?\d*$/.test(rawValue)) {
        return
      }

      // Remove leading zeros for integer part (but keep "0." for decimals)
      let sanitizedValue = rawValue
      if (sanitizedValue.match(/^-?0\d+/) && !sanitizedValue.includes('.')) {
        // Strip leading zeros: "0123" -> "123", "-0123" -> "-123"
        sanitizedValue = sanitizedValue.replace(/^(-?)0+/, '$1')
        if (sanitizedValue === '' || sanitizedValue === '-') {
          sanitizedValue = '0'
        }
      }

      setDisplayValue(sanitizedValue)

      // Only call parent onChange with valid number
      const numValue = parseFloat(sanitizedValue)
      if (!isNaN(numValue)) {
        // Create a synthetic event with the numeric value
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: sanitizedValue,
          },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
    },
    [onChange],
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // On blur, ensure we have a valid number (default to 0 if empty)
    if (displayValue === '' || displayValue === '-' || isNaN(parseFloat(displayValue))) {
      setDisplayValue(String(min ?? 0))
    }
  }, [displayValue, min])

  return (
    <div className={styles.wrapper} style={disabled ? { opacity: 0.5 } : undefined}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.inputContainer}>
        <input
          type="text"
          inputMode="decimal"
          className={c([styles.input, variant && styles[variant], { [styles.withIcon]: !!icon }])}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
        />
        {icon && (
          <div className={c(styles.icon, { [styles[`rotate${rotate}`]]: !!rotate })}>
            <Icon name={icon} size={16} color="#444444" />
          </div>
        )}
      </div>
    </div>
  )
}

export default NumberInput
