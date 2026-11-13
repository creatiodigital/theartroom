'use client'

import { Fragment } from 'react'
import type { Icon } from '@phosphor-icons/react'
import c from 'classnames'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

import styles from './SegmentStrip.module.scss'

export type Segment = {
  key: string
  /** The visible text; for an icon segment, its accessible name and tooltip. */
  label: string
  /** An icon-only segment when given. */
  icon?: Icon
  /** A choice (`aria-pressed`); left out for an action (e.g. "Top of the wall"). */
  pressed?: boolean
  onClick: () => void
  disabled?: boolean
}

type SegmentStripProps = {
  /** The group's accessible name, e.g. "Show". */
  label: string
  segments: Segment[]
}

/**
 * A segmented control of the wall view (wallview.md, designs/wall-view*.dc.html): a grey track
 * of joined buttons, the pressed one raised in white. A plain group of buttons in the Tab order:
 * no arrow keys, which the wall uses to nudge the selected work.
 */
export function SegmentStrip({ label, segments }: SegmentStripProps) {
  return (
    <div role="group" aria-label={label} className={styles.strip}>
      {segments.map(({ key, label: name, icon: SegmentIcon, pressed, onClick, disabled }) => {
        const button = (
          <Button
            variant="bare"
            font="dashboard"
            className={c(styles.segment, pressed && styles.pressed)}
            aria-pressed={pressed}
            aria-label={SegmentIcon ? name : undefined}
            onClick={onClick}
            disabled={disabled}
          >
            {SegmentIcon ? <SegmentIcon size={16} weight="light" aria-hidden /> : name}
          </Button>
        )

        return SegmentIcon ? (
          <Tooltip key={key} label={name} placement="top" fullWidth>
            {button}
          </Tooltip>
        ) : (
          <Fragment key={key}>{button}</Fragment>
        )
      })}
    </div>
  )
}
