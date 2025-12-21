import type { ReactNode } from 'react'

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

type HeadingProps = {
  /** The HTML element to render (semantic level) */
  as?: HeadingLevel
  /** Visual size override (defaults to same as `as`) */
  size?: HeadingLevel
  children: ReactNode
  className?: string
  id?: string
}

export function Heading({
  as = 'h1',
  size,
  children,
  className = '',
  ...props
}: HeadingProps) {
  const Component = as
  const visualSize = size || as
  
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

type TextProps = {
  /** The HTML element to render */
  as?: TextElement
  /** Font size variant */
  size?: TextSize
  /** Font weight */
  weight?: TextWeight
  /** Muted/lighter color */
  muted?: boolean
  children: ReactNode
  className?: string
}

export function Text({
  as = 'p',
  size = 'base',
  weight = 'normal',
  muted = false,
  children,
  className = '',
  ...props
}: TextProps) {
  const Component = as
  
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
