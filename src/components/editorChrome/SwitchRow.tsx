'use client'

import { useId, type ChangeEventHandler, type ReactNode } from 'react'

import { Toggle } from '@/components/ui/Toggle'

import styles from './SwitchRow.module.scss'

type SwitchRowProps = {
  /** The visible name; also the switch's accessible name unless `aria-label` says more. */
  title: ReactNode
  /** A line under the title (e.g. "Off", a panel's artwork count), tied as its description. */
  line?: ReactNode
  checked: boolean
  /** The panel's own handler, unchanged. */
  onChange: ChangeEventHandler<HTMLInputElement>
  /** Only where the title needs context, and then containing its words (Q135). */
  'aria-label'?: string
  /** "On" / "Off" before the switch (the lamp detail). */
  stateText?: boolean
  disabled?: boolean
}

/** A name, an optional line and the editor's switch (editor3d.md "Switches"). */
export function SwitchRow({
  title,
  line,
  checked,
  onChange,
  'aria-label': ariaLabel,
  stateText = false,
  disabled,
}: SwitchRowProps) {
  const titleId = useId()
  const lineId = useId()

  return (
    <div className={styles.row}>
      <span className={styles.text}>
        <span id={titleId} className={styles.title}>
          {title}
        </span>
        {line && (
          <span id={lineId} className={styles.line}>
            {line}
          </span>
        )}
      </span>
      <span className={styles.control}>
        {stateText && (
          <span className={styles.state} aria-hidden>
            {checked ? 'On' : 'Off'}
          </span>
        )}
        <Toggle
          tone="editor"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-describedby={line ? lineId : undefined}
        />
      </span>
    </div>
  )
}
