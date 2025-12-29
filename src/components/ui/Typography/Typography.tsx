import type { ReactNode, HTMLAttributes } from 'react'

import styles from './Typography.module.scss'

/* =============================================================================
   Heading Component
   
   Polymorphic heading component that allows semantic/visual separation.
   
   Usage:
     <Heading>Page Title</Heading>                    // Renders as h1, looks like h1, serif font
     <Heading as="h2">Section</Heading>               // Renders as h2, looks like h2
     <Heading as="h2" size="h3">Subheading</Heading>  // Renders as h2, looks like h3
     <Heading font="sans">Title</Heading>             // Sans-serif font
   
   Convenience components:
     <H1>Title</H1>
     <H2 font="sans">Subtitle</H2>
   ============================================================================= */

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
type FontFamily = 'serif' | 'sans'
type HeadingWeight = 'light' | 'normal' | 'medium' | 'bold'

type HeadingProps = {
  /** The HTML element to render (semantic level) */
  as?: HeadingLevel
  /** Visual size override (defaults to same as `as`) */
  size?: HeadingLevel
  /** Font family: 'serif' (default) or 'sans' */
  font?: FontFamily
  /** Font weight: 'light' (300), 'normal' (400, default), 'medium' (500), 'bold' (700) */
  fontWeight?: HeadingWeight
  children: ReactNode
  className?: string
} & Omit<HTMLAttributes<HTMLHeadingElement>, 'children' | 'className'>

export function Heading({
  as = 'h1',
  size,
  font = 'serif',
  fontWeight = 'normal',
  children,
  className = '',
  ...props
}: HeadingProps) {
  const Component = as
  const visualSize = size || as
  
  const classNames = [
    styles[visualSize],
    styles[`font-${font}`],
    styles[`heading-weight-${fontWeight}`],
    className,
  ].filter(Boolean).join(' ')
  
  return (
    <Component className={classNames} {...props}>
      {children}
    </Component>
  )
}

/* =============================================================================
   Convenience Components
   
   Pre-configured heading components for common use cases.
   ============================================================================= */

type HProps = Omit<HeadingProps, 'as'>

export function H1(props: HProps) {
  return <Heading as="h1" {...props} />
}

export function H2(props: HProps) {
  return <Heading as="h2" {...props} />
}

export function H3(props: HProps) {
  return <Heading as="h3" {...props} />
}

export function H4(props: HProps) {
  return <Heading as="h4" {...props} />
}

export function H5(props: HProps) {
  return <Heading as="h5" {...props} />
}

export function H6(props: HProps) {
  return <Heading as="h6" {...props} />
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
