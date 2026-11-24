'use client'

import { TextSection } from '@/components/ui/TextSection'
import {
  OBJECT_DISPLAY_LABEL,
  OBJECT_PLACEMENT_LABEL,
  objectEditionLine,
} from '@/lib/artwork/objectArtwork'
import { formatObjectSize, formatWeight } from '@/lib/units/format'
import { useUnits } from '@/lib/units/UnitsProvider'

import styles from './ObjectDetail.module.scss'

export type ObjectDetailsFields = {
  heightCm: number | null
  widthCm: number | null
  depthCm: number | null
  weightKg: number | null
  sizeIncludesBase: boolean
  objectEdition: string | null
  objectEditionNo: number | null
  objectEditionOf: number | null
  objectArtistProofs: number | null
  placement: string | null
  displayMode: string | null
  signedNote: string | null
  certificateNote: string | null
  careNote: string | null
}

/**
 * "Details" under an Object (docs/objects O5): label / value rows, only the filled ones. The size
 * follows the visitor's cm | in (and kg | lb).
 */
export function ObjectDetails({ fields }: { fields: ObjectDetailsFields }) {
  const { unit } = useUnits()
  const size = formatObjectSize(fields, unit)
  const sizeValue = size
    ? `${size}${fields.sizeIncludesBase ? ', with base' : ''}${
        fields.weightKg ? ` · ${formatWeight(fields.weightKg, unit)}` : ''
      }`
    : fields.weightKg
      ? formatWeight(fields.weightKg, unit)
      : null

  const rows = [
    { label: 'Size', value: sizeValue },
    { label: 'Edition', value: objectEditionLine(fields, 'long') },
    {
      label: 'Where it can stand',
      value: fields.placement ? (OBJECT_PLACEMENT_LABEL[fields.placement] ?? null) : null,
    },
    {
      label: 'Display',
      value: fields.displayMode ? (OBJECT_DISPLAY_LABEL[fields.displayMode] ?? null) : null,
    },
    { label: 'Signed', value: fields.signedNote },
    { label: 'Certificate', value: fields.certificateNote },
    { label: 'Care', value: fields.careNote },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value))

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
