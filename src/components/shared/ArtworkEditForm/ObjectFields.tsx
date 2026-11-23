'use client'

import { SegmentedControl } from '@/components/admin/ui/SegmentedControl'
import { AdminCheckbox } from '@/components/admin/ui/AdminCheckbox'
import { Input } from '@/components/ui/Input'
import { objectDimensionsText, objectEditionText } from '@/lib/artwork/objectArtwork'

import formStyles from './ArtworkEditForm.module.scss'
import styles from './ObjectFields.module.scss'

/**
 * An Object's own form fields (docs/objects "What an Object has"), as the editor holds them:
 * what was typed ('' = not set; the server reads "12,5" too), the cover's crop as numbers.
 */
export type ObjectFormFields = {
  coverCropX: number | null
  coverCropY: number | null
  heightCm: string
  widthCm: string
  depthCm: string
  weightKg: string
  sizeIncludesBase: boolean
  /** '' | 'unique' | 'edition' */
  objectEdition: string
  objectEditionNo: string
  objectEditionOf: string
  objectArtistProofs: string
  /** '' | 'indoors' | 'outdoors' | 'both' */
  placement: string
  /** '' | 'floor' | 'pedestal' | 'wall' | 'hanging' */
  displayMode: string
  signedNote: string
  certificateNote: string
  careNote: string
}

type Stored = {
  coverCropX?: number | null
  coverCropY?: number | null
  heightCm?: number | null
  widthCm?: number | null
  depthCm?: number | null
  weightKg?: number | null
  sizeIncludesBase?: boolean
  objectEdition?: string | null
  objectEditionNo?: number | null
  objectEditionOf?: number | null
  objectArtistProofs?: number | null
  placement?: string | null
  displayMode?: string | null
  signedNote?: string | null
  certificateNote?: string | null
  careNote?: string | null
}

const text = (n: number | null | undefined) => (typeof n === 'number' ? String(n) : '')

/** The form's Object fields from a loaded artwork (any type: the fields are simply empty). */
export const objectFormFields = (data: Stored): ObjectFormFields => ({
  coverCropX: data.coverCropX ?? null,
  coverCropY: data.coverCropY ?? null,
  heightCm: text(data.heightCm),
  widthCm: text(data.widthCm),
  depthCm: text(data.depthCm),
  weightKg: text(data.weightKg),
  sizeIncludesBase: data.sizeIncludesBase ?? false,
  objectEdition: data.objectEdition ?? '',
  objectEditionNo: text(data.objectEditionNo),
  objectEditionOf: text(data.objectEditionOf),
  objectArtistProofs: text(data.objectArtistProofs),
  placement: data.placement ?? '',
  displayMode: data.displayMode ?? '',
  signedNote: data.signedNote ?? '',
  certificateNote: data.certificateNote ?? '',
  careNote: data.careNote ?? '',
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

/** Clicking the pressed option clears it: every choice here is optional. */
const toggle = (current: string, next: string) => (current === next ? '' : next)

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

/** Details › Size and Edition (objects-editor.dc.html). */
export function ObjectSizeAndEdition({ fields, onChange }: FieldsProps) {
  const size = objectDimensionsText({
    heightCm: typed(fields.heightCm),
    widthCm: typed(fields.widthCm),
    depthCm: typed(fields.depthCm),
  })
  const edition = objectEditionText({
    objectEdition: fields.objectEdition,
    objectEditionNo: typed(fields.objectEditionNo),
    objectEditionOf: typed(fields.objectEditionOf),
    objectArtistProofs: typed(fields.objectArtistProofs),
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
        <AdminCheckbox
          id="object-size-includes-base"
          label="Size includes the base"
          checked={fields.sizeIncludesBase}
          onChange={(checked) => onChange('sizeIncludesBase', checked)}
        />
        {size && (
          <span className={formStyles.help}>
            Visitors see it as {size}, or in inches if they switch.
          </span>
        )}
      </fieldset>

      <div className={styles.group}>
        <span className={formStyles.label}>Edition</span>
        <div className={styles.editionRow}>
          <SegmentedControl
            label="Edition"
            options={[
              { id: 'unique', label: 'Unique piece' },
              { id: 'edition', label: 'Edition' },
            ]}
            value={fields.objectEdition}
            onChange={(id) => onChange('objectEdition', toggle(fields.objectEdition, id))}
          />
          {fields.objectEdition === 'edition' && (
            <>
              <label className={styles.inline}>
                Number
                <span className={styles.unit}>
                  <Input
                    type="text"
                    inputMode="numeric"
                    size="bare"
                    className={styles.unitControl}
                    inputClassName={styles.numberInput}
                    aria-label="This is number"
                    value={fields.objectEditionNo}
                    onChange={(e) => onChange('objectEditionNo', e.target.value)}
                  />
                  <span aria-hidden className={styles.unitName}>
                    /
                  </span>
                </span>
              </label>
              <label className={styles.inline}>
                of
                <span className={styles.unit}>
                  <Input
                    type="text"
                    inputMode="numeric"
                    size="bare"
                    className={styles.unitControl}
                    inputClassName={styles.numberInput}
                    aria-label="Edition size"
                    value={fields.objectEditionOf}
                    onChange={(e) => onChange('objectEditionOf', e.target.value)}
                  />
                </span>
              </label>
              <label className={styles.inline}>
                + artist’s proofs
                <span className={styles.unit}>
                  <Input
                    type="text"
                    inputMode="numeric"
                    size="bare"
                    className={styles.unitControl}
                    inputClassName={styles.numberInput}
                    aria-label="Artist's proofs"
                    value={fields.objectArtistProofs}
                    onChange={(e) => onChange('objectArtistProofs', e.target.value)}
                  />
                </span>
              </label>
            </>
          )}
        </div>
        {edition && fields.objectEdition === 'edition' && (
          <span className={formStyles.help}>Shown as “{edition}”.</span>
        )}
      </div>
    </>
  )
}

/** Technical info (objects-editor.dc.html): every field optional; only filled ones show. */
export function ObjectTechnicalInfo({ fields, onChange }: FieldsProps) {
  return (
    <>
      <div className={styles.techGrid}>
        <div className={styles.group}>
          <span className={formStyles.label}>Where it can stand</span>
          <SegmentedControl
            label="Where it can stand"
            options={[
              { id: 'indoors', label: 'Indoors' },
              { id: 'outdoors', label: 'Outdoors' },
              { id: 'both', label: 'Both' },
            ]}
            value={fields.placement}
            onChange={(id) => onChange('placement', toggle(fields.placement, id))}
          />
        </div>
        <div className={styles.group}>
          <span className={formStyles.label}>Display</span>
          <SegmentedControl
            label="Display"
            options={[
              { id: 'floor', label: 'Floor' },
              { id: 'pedestal', label: 'Pedestal' },
              { id: 'wall', label: 'Wall' },
              { id: 'hanging', label: 'Hanging' },
            ]}
            value={fields.displayMode}
            onChange={(id) => onChange('displayMode', toggle(fields.displayMode, id))}
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor="object-signed" className={formStyles.label}>
            Signed / marked
          </label>
          <Input
            id="object-signed"
            type="text"
            size="bare"
            inputClassName={formStyles.input}
            maxLength={300}
            value={fields.signedNote}
            onChange={(e) => onChange('signedNote', e.target.value)}
          />
        </div>
        <div className={formStyles.field}>
          <label htmlFor="object-certificate" className={formStyles.label}>
            Certificate
          </label>
          <Input
            id="object-certificate"
            type="text"
            size="bare"
            inputClassName={formStyles.input}
            maxLength={300}
            value={fields.certificateNote}
            onChange={(e) => onChange('certificateNote', e.target.value)}
          />
        </div>
      </div>
      <div className={formStyles.field}>
        <label htmlFor="object-care" className={formStyles.label}>
          Care and installation
        </label>
        <textarea
          id="object-care"
          className={formStyles.textarea}
          rows={3}
          maxLength={2000}
          value={fields.careNote}
          onChange={(e) => onChange('careNote', e.target.value)}
        />
      </div>
    </>
  )
}
