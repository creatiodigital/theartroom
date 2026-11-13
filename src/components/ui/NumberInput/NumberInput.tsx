'use client'

import { useState, useEffect, useCallback } from 'react'
import c from 'classnames'

import styles from './NumberInput.module.scss'

export type NumberInputProps = {
  value: number
  onChange: React.ChangeEventHandler<HTMLInputElement>
  max?: number
  min?: number
  disabled?: boolean
  /** The field's name where no visible label wraps it (e.g. "From top, cm"). */
  'aria-label'?: string
  /** A unit drawn inside the box after the number, e.g. "cm" (decorative). */
  suffix?: string
  /** regular: a 36px field; compact: the 28px number inside a distance box (wallview.md). */
  size?: 'regular' | 'compact'
}

/**
 * The wall view's number field (its only user, wallview.md): a text input that takes digits,
 * one decimal point or comma and a leading minus, and reports only valid numbers.
 */
const NumberInput = ({
  value,
  onChange,
  max: _max,
  min,
  disabled,
  'aria-label': ariaLabel,
  suffix,
  size = 'regular',
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
    <span
      className={c(styles.field, size === 'compact' && styles.compact)}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        className={styles.input}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      {suffix && (
        <span aria-hidden className={styles.suffix}>
          {suffix}
        </span>
      )}
    </span>
  )
}

export default NumberInput
