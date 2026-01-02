import type { ReactNode, HTMLAttributes } from 'react'

import styles from './Typography.module.scss'

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label'
type TextSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
type FontFamily = 'serif' | 'sans'
type TextWeight = 'light' | 'normal' | 'medium' | 'bold'
type TextOwnProps<T extends TextElement = 'span'> = {
  as?: T
  size?: TextSize
  font?: FontFamily
  weight?: TextWeight
  muted?: boolean
  children: ReactNode
  className?: string
}
type PolymorphicTextProps<T extends TextElement> = TextOwnProps<T> &
  Omit<HTMLAttributes<HTMLElement>, keyof TextOwnProps<T>>

const headingElements = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const getDefaultFont = (element: TextElement): FontFamily => {
  return headingElements.has(element) ? 'serif' : 'sans'
}

const getSizeClass = (element: TextElement, size?: TextSize): string => {
  if (size) {
    if (headingElements.has(size)) {
      return styles[size] || ''
    }
    return styles[`text-${size}`] || ''
  }

  if (headingElements.has(element)) {
    return styles[element] || ''
  }
  return styles.paragraph || ''
}

const getWeightClass = (element: TextElement, weight?: TextWeight): string => {
  if (!weight) {
    if (headingElements.has(element)) {
      return styles['heading-weight-normal']
    }
    if (headingElements.has(element)) {
      return styles['heading-weight-normal']
    }
    return ''
  }

  if (headingElements.has(element)) {
    return styles[`heading-weight-${weight}`] || ''
  }
  return styles[`weight-${weight}`] || ''
}

export function Text<T extends TextElement = 'span'>({
  as,
  size,
  font,
  weight,
  muted = false,
  children,
  className = '',
  ...rest
}: PolymorphicTextProps<T>) {
  const Component = (as || 'span') as TextElement
  const resolvedFont = font || getDefaultFont(Component)

  const classNames = [
    getSizeClass(Component, size),
    styles[`font-${resolvedFont}`],
    getWeightClass(Component, weight),
    muted && styles.muted,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Component className={classNames} {...rest}>
      {children}
    </Component>
  )
}
