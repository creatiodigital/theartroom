import { Cube } from '@phosphor-icons/react'
import c from 'classnames'

import styles from './ObjectSpaceChip.module.scss'

const CHIP: Record<string, { label: string; className: string } | undefined> = {
  ready: { label: 'In the 3D space', className: styles.ready },
  requested: { label: '3D model in preparation', className: styles.preparing },
}

/**
 * An Object's 3D state (docs/objects, objects-library / objects-editor): "In the 3D space" once
 * its model is ready, "3D model in preparation" while asked for; nothing otherwise.
 */
export function ObjectSpaceChip({ modelStatus }: { modelStatus?: string | null }) {
  const chip = CHIP[modelStatus ?? '']
  if (!chip) return null
  return (
    <span className={c(styles.chip, chip.className)}>
      <Cube size={12} weight="regular" aria-hidden />
      {chip.label}
    </span>
  )
}
