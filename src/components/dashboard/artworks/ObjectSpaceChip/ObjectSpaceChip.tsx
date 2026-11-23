import { Cube } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './ObjectSpaceChip.module.scss'

const CHIP: Record<string, { label: string; short: string; className: string } | undefined> = {
  ready: { label: 'In the 3D space', short: 'Ready', className: styles.ready },
  requested: {
    label: '3D model in preparation',
    short: 'In preparation',
    className: styles.preparing,
  },
}

/**
 * An Object's 3D state (docs/objects, objects-library / objects-editor): "In the 3D space" once
 * its model is ready, "3D model in preparation" while asked for; nothing otherwise. `short`: the
 * editor's In the 3D space panel, "Ready" / "In preparation" after a dot.
 */
export function ObjectSpaceChip({
  modelStatus,
  short = false,
}: {
  modelStatus?: string | null
  short?: boolean
}) {
  const chip = CHIP[modelStatus ?? '']
  if (!chip) return null
  return (
    <span className={c(styles.chip, chip.className)}>
      {short ? (
        <span aria-hidden className={styles.dot} />
      ) : (
        <Cube size={12} weight="regular" aria-hidden />
      )}
      {short ? chip.short : chip.label}
    </span>
  )
}
