import type { ReactNode, ElementType, ComponentPropsWithoutRef } from 'react'

import styles from './Typography.module.scss'

/* =============================================================================
   Heading Component
   
   Polymorphic heading component that allows semantic/visual separation.
   
   Usage:
     <Heading>Page Title</Heading>                    // Renders as h1, looks like h1
     <Heading as="h2">Section</Heading>               // Renders as h2, looks like h2
     <Heading as="h2" size="h3">Subheading</Heading>  // Renders as h2, looks like h3
   ============================================================================= */

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

type HeadingProps<T extends HeadingLevel = 'h1'> = {
  /** The HTML element to render (semantic level) */
  as?: T
  /** Visual size override (defaults to same as `as`) */
  size?: HeadingLevel
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'size' | 'children' | 'className'>

export function Heading<T extends HeadingLevel = 'h1'>({
  as,
  size,
  children,
  className = '',
  ...props
}: HeadingProps<T>) {
  const Component = (as || 'h1') as ElementType
  const visualSize = size || as || 'h1'
  
  return (
    <Component 
      className={`${styles[visualSize]} ${className}`.trim()} 
      {...props}
    >
      {children}
    </Component>
  )
}

/* =============================================================================
   Text Component
   
   Polymorphic text component for body copy.
   
   Usage:
     <Text>Paragraph text</Text>                      // Renders as p
     <Text as="span">Inline text</Text>               // Renders as span
     <Text size="sm" weight="bold">Small bold</Text>  // Size and weight variants
   ============================================================================= */

type TextElement = 'p' | 'span' | 'div' | 'label'
type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl'
type TextWeight = 'light' | 'normal' | 'medium' | 'bold'

type TextProps<T extends TextElement = 'p'> = {
  /** The HTML element to render */
  as?: T
  /** Font size variant */
  size?: TextSize
  /** Font weight */
  weight?: TextWeight
  /** Muted/lighter color */
  muted?: boolean
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'size' | 'children' | 'className'>

export function Text<T extends TextElement = 'p'>({
  as,
  size = 'base',
  weight = 'normal',
  muted = false,
  children,
  className = '',
  ...props
}: TextProps<T>) {
  const Component = (as || 'p') as ElementType
  
  const classNames = [
    styles[`text-${size}`],
    styles[`weight-${weight}`],
    muted && styles.muted,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  
  return (
    <Component className={classNames} {...props}>
      {children}
    </Component>
  )
}
