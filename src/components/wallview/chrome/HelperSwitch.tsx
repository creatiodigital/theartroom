'use client'

import { useId, type ChangeEventHandler } from 'react'
import type { Icon } from '@phosphor-icons/react'
import c from 'classnames'

import { Toggle } from '@/components/ui/Toggle'

import styles from './HelperSwitch.module.scss'

type HelperSwitchProps = {
  icon: Icon
  /** The visible name; also the switch's accessible name. */
  title: string
  /** One line under the name, tied to the switch as its description. */
  line?: string
  checked: boolean
  /** The panel's own toggle handler, unchanged. */
  onChange: ChangeEventHandler<HTMLInputElement>
  disabled?: boolean
  /** Indented under the helper it depends on (Lock guides under Rulers & guides). */
  dependent?: boolean
}

/**
 * A row of the wall view's Helpers (wallview.md §1): an icon tile (dark while on), the name and
 * its line, the editor's switch. Its own row rather than `SwitchRow`: the drawn 13 / 11.5px text,
 * and a disabled helper dims its tile and words (the switch keeps Toggle's own disabled look).
 */
export function HelperSwitch({
  icon: HelperIcon,
  title,
  line,
  checked,
  onChange,
  disabled,
  dependent = false,
}: HelperSwitchProps) {
  const titleId = useId()
  const lineId = useId()

  return (
    <div className={c(styles.helper, dependent && styles.dependent, disabled && styles.off)}>
      <span aria-hidden className={c(styles.tile, checked && styles.on)}>
        <HelperIcon size={16} weight="light" aria-hidden />
      </span>
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
      <Toggle
        tone="editor"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-labelledby={titleId}
        aria-describedby={line ? lineId : undefined}
      />
    </div>
  )
}
