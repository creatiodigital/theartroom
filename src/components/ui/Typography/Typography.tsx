import type { ReactNode, HTMLAttributes } from 'react'
import styles from './Typography.module.scss'

type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label' | 'a'

type TextSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'huge'
type FontFamily = 'serif' | 'sans' | 'dashboard'
type TextWeight = 'light' | 'normal' | 'medium' | 'bold'

type TextOwnProps<T extends TextElement> = {
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

const DEFAULT_SIZE_BY_ELEMENT: Partial<Record<TextElement, TextSize>> = {
  h1: '2xl',
  h2: 'xl',
  h3: 'lg',
  h4: 'md',
  h5: 'sm',
  h6: 'xs',
  p: 'md',
  span: 'md',
}

// Headings default to serif (matching globals.scss)
const HEADING_ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

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

  // If the consumer passes a `className` they're presumably styling the
  // text themselves; skip the default-by-element size class so the
  // consumer's class wins at equal specificity without needing
  // `!important`. They can still pass an explicit `size` to opt back in.
  const resolvedSize = size || (className ? undefined : DEFAULT_SIZE_BY_ELEMENT[Component])
  const resolvedFont = font || (HEADING_ELEMENTS.includes(Component) ? 'serif' : 'sans')

  const classNames = [
    resolvedSize && styles[`text-${resolvedSize}`],
    styles[`font-${resolvedFont}`],
    weight && styles[`weight-${weight}`],
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
