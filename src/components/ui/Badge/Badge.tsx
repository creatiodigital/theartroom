'use client'

import c from 'classnames'

import styles from './Badge.module.scss'

type BadgeVariant = 'current' | 'past' | 'published' | 'unpublished' | 'neutral'
type BadgeSize = 'small' | 'regular'

type BadgeProps = {
  label: string
  variant?: BadgeVariant
  size?: BadgeSize
  className?: string
}

export const Badge = ({ label, variant = 'neutral', size = 'small', className }: BadgeProps) => {
  return <span className={c(styles.badge, styles[variant], styles[size], className)}>{label}</span>
}

export default Badge
