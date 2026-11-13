'use client'

import c from 'classnames'
import { useState, useRef, useEffect } from 'react'

import { Icon } from '@/components/ui/Icon'

import styles from './Select.module.scss'

export type SelectOption<T> = {
  value: T
  label: string
}

export type SelectProps<T extends string | number = string | number> = {
  options: SelectOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  size?: 'small' | 'medium'
  disabled?: boolean
  /**
   * editor: the wall view's selects (wallview.md, designs/wall-view-panels.dc.html): 36px
   * (44px on touch), the editor's border and radius, Geist 13px. Default: unchanged.
   */
  tone?: 'default' | 'editor'
  /** The combobox's name, when no visible label names it (questions.md Q135). */
  'aria-label'?: string
  /** The id of the visible label that names the combobox. */
  'aria-labelledby'?: string
}

const Select = <T extends string | number = string | number>({
  options,
  value,
  onChange,
  size = 'small',
  disabled,
  tone = 'default',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  const currentOption =
    options.find((opt) => opt.value === value) ?? ({ label: '', value: '' as T } as SelectOption<T>)

  const handleSelect = (option: SelectOption<T>) => {
    setIsOpen(false)
    onChange(option.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(!isOpen)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleOptionKeyDown = (e: React.KeyboardEvent, option: SelectOption<T>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect(option)
    }
  }

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div
      className={c(styles.select, size && styles[size], tone === 'editor' && styles.editor)}
      ref={selectRef}
      style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      <div
        className={styles.input}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        {currentOption?.label ?? ''}
        <Icon name="chevronDown" size={size === 'medium' ? 20 : 16} color="#333333" />
      </div>

      {isOpen && (
        <ul className={styles.dropdown} role="listbox" onMouseDown={(e) => e.stopPropagation()}>
          {options.map((option) => (
            <li
              key={option.value}
              className={styles.option}
              role="option"
              tabIndex={0}
              aria-selected={option.value === value}
              onClick={() => handleSelect(option)}
              onKeyDown={(e) => handleOptionKeyDown(e, option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Select
