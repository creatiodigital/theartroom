'use client'

import { Input } from '@/components/ui/Input'
import { objectDimensionsText } from '@/lib/artwork/objectArtwork'

import formStyles from './ArtworkEditForm.module.scss'
import styles from './ObjectFields.module.scss'

/**
 * An Object's own form fields (docs/objects "What an Object has"), as the editor holds them:
 * what was typed ('' = not set; the server reads "12,5" too).
 */
export type ObjectFormFields = {
  heightCm: string
  widthCm: string
  depthCm: string
  weightKg: string
}

type Stored = {
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  weightKg?: number | null
}

const text = (n: number | null | undefined) => (typeof n === 'number' ? String(n) : '')

/** The form's Object fields from a loaded artwork (any type: the fields are simply empty). */
export const objectFormFields = (data: Stored): ObjectFormFields => ({
  heightCm: text(data.heightCm),
  widthCm: text(data.widthCm),
  depthCm: text(data.depthCm),
  weightKg: text(data.weightKg),
})

/** A typed amount, for the help lines only (the server validates what is saved). */
const typed = (value: string): number | null => {
  const n = Number(value.trim().replace(',', '.'))
  return value.trim() && Number.isFinite(n) && n > 0 ? n : null
}

type FieldsProps = {
  fields: ObjectFormFields
  onChange: (field: keyof ObjectFormFields, value: string | boolean) => void
}

function UnitField({
  id,
  label,
  unit,
  unitName,
  value,
  onChange,
}: {
  id: string
  label: string
  unit: string
  unitName: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className={styles.unitField}>
      <label htmlFor={id} className={formStyles.help}>
        {label}
        <span className="sr-only"> in {unitName}</span>
      </label>
      <span className={styles.unit}>
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          size="bare"
          className={styles.unitControl}
          inputClassName={styles.unitInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span aria-hidden className={styles.unitName}>
          {unit}
        </span>
      </span>
    </div>
  )
}

/**
 * Details › Size (objects-editor.dc.html). No Edition: an Object is always sold as a unique piece
 * (owner, 2026-11-25), so there are no edition numbers or artist's proofs.
 */
export function ObjectSize({ fields, onChange }: FieldsProps) {
  const size = objectDimensionsText({
    heightCm: typed(fields.heightCm),
    widthCm: typed(fields.widthCm),
    depthCm: typed(fields.depthCm),
  })
  return (
    <>
      <fieldset className={styles.group}>
        <legend className={formStyles.label}>Size</legend>
        <div className={styles.sizeRow}>
          <UnitField
            id="object-height"
            label="Height"
            unit="cm"
            unitName="cm"
            value={fields.heightCm}
            onChange={(v) => onChange('heightCm', v)}
          />
          <UnitField
            id="object-width"
            label="Width"
            unit="cm"
            unitName="cm"
            value={fields.widthCm}
            onChange={(v) => onChange('widthCm', v)}
          />
          <UnitField
            id="object-depth"
            label="Depth"
            unit="cm"
            unitName="cm"
            value={fields.depthCm}
            onChange={(v) => onChange('depthCm', v)}
          />
          <UnitField
            id="object-weight"
            label="Weight"
            unit="kg"
            unitName="kg"
            value={fields.weightKg}
            onChange={(v) => onChange('weightKg', v)}
          />
        </div>
        {size && (
          <span className={formStyles.help}>
            Visitors see it as {size}, or in inches if they switch.
          </span>
        )}
      </fieldset>
    </>
  )
}
