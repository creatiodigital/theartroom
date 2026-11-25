'use client'

import { TextSection } from '@/components/ui/TextSection'
import { formatObjectSize, formatWeight } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import styles from './ObjectDetail.module.scss'

export type ObjectDetailsFields = {
  heightCm: number | null
  widthCm: number | null
  depthCm: number | null
  weightKg: number | null
}

/**
 * "Details" under an Object (docs/objects O5): label / value rows, only the filled ones. The size
 * follows the visitor's cm | in; the weight stays in kg (Q-O9).
 */
export function ObjectDetails({ fields }: { fields: ObjectDetailsFields }) {
  const { unit } = useUnits()
  const size = formatObjectSize(fields, unit)
  const sizeValue = size
    ? `${size}${fields.weightKg ? ` · ${formatWeight(fields.weightKg)}` : ''}`
    : fields.weightKg
      ? formatWeight(fields.weightKg)
      : null

  const rows = [{ label: 'Size', value: sizeValue }].filter(
    (row): row is { label: string; value: string } => Boolean(row.value),
  )

  if (rows.length === 0) return null

  return (
    <TextSection label="Details" className={styles.belowSection}>
      <dl className={styles.details}>
        {rows.map((row) => (
          <div key={row.label} className={styles.detailRow}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </TextSection>
  )
}
