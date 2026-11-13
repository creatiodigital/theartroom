'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'

import styles from './CopyField.module.scss'

/** How long "Copied" replaces the button label (orders.md §2). */
const COPIED_MS = 2000

function useCopied() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // "Copied" only once the clipboard took the text: a refused write (no
  // permission, page not focused) leaves the label as it was.
  const copy = useCallback((value: string) => {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), COPIED_MS)
      },
      () => setCopied(false),
    )
  }, [])

  return { copied, copy }
}

type CopyButtonProps = {
  /** Exactly what lands on the clipboard. */
  value: string
  /** Visible label, e.g. "Copy reference". "Copied" replaces it for 2 s. */
  label: string
  /** Words only screen readers hear after the label, e.g. the field name. */
  srSuffix?: string
  /** compact: the 28px "Copy" inside a CopyField row (44px below 900px either way). */
  size?: 'regular' | 'compact'
  /** A mark before the label, e.g. Copy on "Copy address for TPS" (light, decorative). */
  icon?: Icon
}

/** A button that copies `value` and says "Copied" for 2 s. */
export function CopyButton({
  value,
  label,
  srSuffix,
  size = 'regular',
  icon: ButtonIcon,
}: CopyButtonProps) {
  const { copied, copy } = useCopied()
  return (
    <span className={styles.buttonWrap}>
      <Button
        variant="bare"
        font="dashboard"
        className={c(styles.button, size === 'compact' && styles.compact)}
        onClick={() => copy(value)}
      >
        {ButtonIcon && <ButtonIcon size={13} weight="light" aria-hidden />}
        {copied ? 'Copied' : label}
        {srSuffix && <span className="sr-only"> {srSuffix}</span>}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </span>
  )
}

type CopyFieldProps = {
  label: string
  /** What the row shows (text, or e.g. an <address>). */
  value: ReactNode
  /** What the button copies. */
  copyValue: string
  /** Visible button text. Defaults to "Copy", spoken as "Copy {label}". */
  buttonLabel?: string
  /** `start` for multi-line values such as an address. */
  align?: 'center' | 'start'
  className?: string
}

/** Label · value (mono) · Copy, one row of a paste-ready block (orders.md §2, TPS placement). */
export function CopyField({
  label,
  value,
  copyValue,
  buttonLabel,
  align = 'center',
  className,
}: CopyFieldProps) {
  return (
    // The outer box is a size container, so the row lays itself out by the
    // width it gets (a side column, a phone) rather than by the screen's.
    <div className={c(styles.field, className)}>
      <div className={c(styles.row, align === 'start' && styles.alignStart)}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
        <CopyButton
          value={copyValue}
          label={buttonLabel ?? 'Copy'}
          srSuffix={buttonLabel ? undefined : label}
          size="compact"
        />
      </div>
    </div>
  )
}
