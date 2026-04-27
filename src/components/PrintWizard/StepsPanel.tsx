'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'

import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import type { SelectOption } from '@/components/ui/SelectDropdown'

import {
  type AvailabilityCheck,
  type BorderDimension,
  type Catalog,
  type Dimension,
  type EnumDimension,
  type Option,
  type PrintRestrictions,
  type SizeDimension,
  type SizeOption,
  type WizardConfig,
  clampCm,
  isDimensionVisible,
  isOptionPickable,
  sizeOptionLabel,
} from '@/lib/print-providers'

import styles from './PrintWizard.module.scss'

interface StepsPanelProps {
  catalog: Catalog
  config: WizardConfig
  aspectRatio: number
  onChange: (patch: Record<string, string>) => void
  onCustomSizeChange: (size: { widthCm: number; heightCm: number }) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
  countryCode: string
  onCountryChange: (code: string) => void
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  noViableCombo: boolean
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code
const sortCountries = (codes: string[]) =>
  [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b)))

export const StepsPanel = ({
  catalog,
  config,
  aspectRatio,
  onChange,
  onCustomSizeChange,
  onBorderChange,
  countryCode,
  onCountryChange,
  availability,
  restrictions,
  noViableCombo,
}: StepsPanelProps) => {
  // Per-step open/closed state. Keyed by dimension id (plus 'destination'
  // for the always-on country picker). Independent — buyer can have any
  // combination open. Destination auto-opens when no country has been
  // picked yet so the buyer's first click reveals the country dropdown
  // directly (otherwise they'd have to click "Destination" first to
  // expose it, which read as broken).
  const [openSteps, setOpenSteps] = useState<Set<string>>(
    () => new Set(countryCode ? [] : ['destination']),
  )
  const toggle = (key: string) => (open: boolean) => {
    setOpenSteps((prev) => {
      const next = new Set(prev)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }

  // Country picker uses the catalog's full supportedCountries list.
  const countryOptions: SelectOption<string>[] = useMemo(
    () =>
      sortCountries(catalog.supportedCountries).map((code) => ({
        value: code,
        label: countryName(code),
      })),
    [catalog.supportedCountries],
  )

  const optionsLocked = !countryCode

  return (
    <aside className={styles.stepsPanel}>
      <CollapsibleSection
        title="Destination"
        open={openSteps.has('destination')}
        onToggle={toggle('destination')}
      >
        <div className={styles.stepField}>
          <SelectDropdown<string>
            label="Country"
            options={countryOptions}
            value={countryCode}
            onChange={onCountryChange}
            placeholder="Choose a country…"
          />
          {countryCode && noViableCombo && (
            <p className={styles.destinationNotice}>
              Sorry — this artwork isn&apos;t currently available for shipping to{' '}
              {countryName(countryCode)}. Try a different destination.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {countryCode && !noViableCombo &&
        catalog.dimensions.map((dim) => (
          <DimensionSection
            key={dim.id}
            dimension={dim}
            catalog={catalog}
            config={config}
            aspectRatio={aspectRatio}
            countryCode={countryCode}
            availability={availability}
            restrictions={restrictions}
            optionsLocked={optionsLocked}
            open={openSteps.has(dim.id)}
            onToggle={toggle(dim.id)}
            onChange={onChange}
            onCustomSizeChange={onCustomSizeChange}
            onBorderChange={onBorderChange}
          />
        ))}
    </aside>
  )
}

// ── Per-dimension renderer ───────────────────────────────────────

interface DimensionSectionProps {
  dimension: Dimension
  catalog: Catalog
  config: WizardConfig
  aspectRatio: number
  countryCode: string
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onChange: (patch: Record<string, string>) => void
  onCustomSizeChange: (size: { widthCm: number; heightCm: number }) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
}

const DimensionSection = ({
  dimension,
  catalog,
  config,
  aspectRatio,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
  onCustomSizeChange,
  onBorderChange,
}: DimensionSectionProps) => {
  const aspectRatioForChild = aspectRatio
  if (!isDimensionVisible(dimension, config, catalog)) return null

  if (dimension.kind === 'orientation') {
    return (
      <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
        <div className={styles.stepField}>
          <p className={styles.destinationHelp}>
            How the print will be hung. Defaulted to match your artwork — flip it if you want a
            different hang.
          </p>
          <div className={styles.orientationChoices} role="radiogroup" aria-label="Orientation">
            {(['portrait', 'landscape'] as const).map((value) => {
              const selected = config.values.orientation === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={optionsLocked}
                  className={`${styles.orientationChoice} ${
                    selected ? styles.orientationChoiceSelected : ''
                  } ${optionsLocked ? styles.orientationChoiceDisabled : ''}`}
                  onClick={() => onChange({ orientation: value })}
                >
                  <span
                    className={`${styles.orientationIcon} ${
                      value === 'landscape' ? styles.orientationIconLandscape : ''
                    }`}
                    aria-hidden="true"
                  />
                  <span className={styles.orientationLabel}>
                    {value === 'portrait' ? 'Portrait' : 'Landscape'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </CollapsibleSection>
    )
  }

  if (dimension.kind === 'size') {
    return (
      <SizeDimensionSection
        dimension={dimension}
        config={config}
        aspectRatio={aspectRatioForChild}
        countryCode={countryCode}
        availability={availability}
        restrictions={restrictions}
        optionsLocked={optionsLocked}
        open={open}
        onToggle={onToggle}
        onChange={onChange}
        onCustomSizeChange={onCustomSizeChange}
      />
    )
  }

  if (dimension.kind === 'border') {
    return (
      <BorderDimensionSection
        dimension={dimension}
        config={config}
        optionsLocked={optionsLocked}
        open={open}
        onToggle={onToggle}
        onBorderChange={onBorderChange}
      />
    )
  }

  // kind === 'enum'
  return (
    <EnumDimensionSection
      dimension={dimension}
      config={config}
      countryCode={countryCode}
      availability={availability}
      restrictions={restrictions}
      optionsLocked={optionsLocked}
      open={open}
      onToggle={onToggle}
      onChange={onChange}
    />
  )
}

// ── Enum dimensions ──────────────────────────────────────────────

interface EnumSectionProps extends Omit<
  DimensionSectionProps,
  'dimension' | 'catalog' | 'aspectRatio' | 'onCustomSizeChange' | 'onBorderChange'
> {
  dimension: EnumDimension
}

const EnumDimensionSection = ({
  dimension,
  config,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
}: EnumSectionProps) => {
  const filtered = useMemo(
    () =>
      dimension.options.filter((option) =>
        isOptionPickable(option, {
          dimensionId: dimension.id,
          config,
          country: countryCode,
          availability,
          restrictions,
        }),
      ),
    [dimension, config, countryCode, availability, restrictions],
  )

  const selectOptions: SelectOption<string>[] = useMemo(
    () =>
      filtered.map((option) => ({
        value: option.id,
        label: option.label,
        tooltip: optionTooltip(option),
        tooltipImage: option.tooltipImageUrl ? (
          <Image src={option.tooltipImageUrl} alt="" width={220} height={220} />
        ) : undefined,
      })),
    [filtered],
  )

  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        <SelectDropdown<string>
          label={dimension.label}
          options={selectOptions}
          value={config.values[dimension.id] ?? ''}
          onChange={(v) => onChange({ [dimension.id]: v })}
          disabled={optionsLocked}
        />
      </div>
    </CollapsibleSection>
  )
}

// ── Size dimension ───────────────────────────────────────────────

interface SizeSectionProps extends Omit<DimensionSectionProps, 'dimension' | 'catalog' | 'onBorderChange'> {
  dimension: SizeDimension
}

const SizeDimensionSection = ({
  dimension,
  config,
  aspectRatio,
  countryCode,
  availability,
  restrictions,
  optionsLocked,
  open,
  onToggle,
  onChange,
  onCustomSizeChange,
}: SizeSectionProps) => {
  const orientation: 'portrait' | 'landscape' =
    config.values.orientation === 'landscape' ? 'landscape' : 'portrait'

  const filtered = useMemo(() => {
    return dimension.options
      .filter((o) => o.printEligible)
      .filter((o) =>
        isOptionPickable(o, {
          dimensionId: dimension.id,
          config,
          country: countryCode,
          availability,
          restrictions,
        }),
      )
  }, [dimension, config, countryCode, availability, restrictions])

  const sorted = useMemo(() => {
    const order: Record<SizeOption['fit'], number> = { perfect: 0, close: 1, mismatch: 2 }
    return [...filtered].sort((a, b) => order[a.fit] - order[b.fit])
  }, [filtered])

  const hasPresets = dimension.options.length > 0
  const customMode = !hasPresets && dimension.custom !== undefined

  const selectOptions: SelectOption<string>[] = useMemo(
    () =>
      sorted.map((size) => ({
        value: size.id,
        label: sizeOptionLabel(size, orientation),
        tooltip: (
          <p>
            This size matches your artwork&apos;s aspect ratio — the whole image prints without
            cropping or padding.
          </p>
        ),
      })),
    [sorted, orientation],
  )

  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        {customMode ? (
          <CustomSizeInputs
            dimension={dimension}
            aspectRatio={aspectRatio}
            customSize={config.customSize}
            disabled={optionsLocked}
            onChange={onCustomSizeChange}
          />
        ) : (
          <SelectDropdown<string>
            label={dimension.label}
            options={selectOptions}
            value={config.values[dimension.id] ?? ''}
            onChange={(v) => onChange({ [dimension.id]: v })}
            disabled={optionsLocked}
          />
        )}
      </div>
    </CollapsibleSection>
  )
}

// ── Custom size (height × width, aspect-locked) ──────────────────

interface CustomSizeInputsProps {
  dimension: SizeDimension
  aspectRatio: number
  customSize: WizardConfig['customSize']
  disabled: boolean
  onChange: (size: { widthCm: number; heightCm: number }) => void
}

const CustomSizeInputs = ({
  dimension,
  aspectRatio,
  customSize,
  disabled,
  onChange,
}: CustomSizeInputsProps) => {
  // Hooks must be called unconditionally on every render. We don't
  // bail out on `!custom` until after they've been declared, so the
  // hook order stays stable when the dimension switches between
  // custom-size and preset-size variants.
  const { custom } = dimension
  const widthCm = customSize?.widthCm ?? 0
  const heightCm = customSize?.heightCm ?? 0
  // Local string state so the user can type/clear freely without
  // each keystroke clamping mid-input. We commit (and clamp) on blur
  // or when the input parses to a valid in-range number — at which
  // point the partner field auto-updates from the locked aspect.
  const stepCmForInit = custom?.stepCm ?? 1
  const [widthInput, setWidthInput] = useState<string>(formatCm(widthCm, stepCmForInit))
  const [heightInput, setHeightInput] = useState<string>(formatCm(heightCm, stepCmForInit))
  const [editing, setEditing] = useState<'width' | 'height' | null>(null)

  if (!custom) return null

  // Sync local input with external customSize updates when the user
  // isn't actively typing in either field.
  if (editing === null) {
    const wStr = formatCm(widthCm, custom.stepCm)
    const hStr = formatCm(heightCm, custom.stepCm)
    if (wStr !== widthInput) setWidthInput(wStr)
    if (hStr !== heightInput) setHeightInput(hStr)
  }

  const aspectLocked = custom.aspectLocked === true
  // The aspect ratio in cm-space. Width / height. When the buyer
  // edits either field, the other follows from this ratio.
  const ratioWH = aspectLocked && aspectRatio > 0 ? aspectRatio : null

  const handleChange = (which: 'width' | 'height', raw: string) => {
    if (which === 'width') setWidthInput(raw)
    else setHeightInput(raw)
    const parsed = Number(raw.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) return

    if (ratioWH === null) {
      // No aspect lock — both fields independent.
      const w =
        which === 'width' ? clampCm(parsed, custom.minCm, custom.maxCm, custom.stepCm) : widthCm
      const h =
        which === 'height' ? clampCm(parsed, custom.minCm, custom.maxCm, custom.stepCm) : heightCm
      onChange({ widthCm: w, heightCm: h })
      return
    }

    if (which === 'width') {
      const w = clampCm(parsed, custom.minCm, custom.maxCm, custom.stepCm)
      const h = clampCm(w / ratioWH, custom.minCm, custom.maxCm, custom.stepCm)
      onChange({ widthCm: w, heightCm: h })
    } else {
      const h = clampCm(parsed, custom.minCm, custom.maxCm, custom.stepCm)
      const w = clampCm(h * ratioWH, custom.minCm, custom.maxCm, custom.stepCm)
      onChange({ widthCm: w, heightCm: h })
    }
  }

  return (
    <div className={styles.customSizeRow}>
      <label className={styles.customSizeField}>
        <span>Height (cm)</span>
        <input
          type="text"
          inputMode="decimal"
          value={heightInput}
          disabled={disabled}
          onFocus={() => setEditing('height')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('height', e.target.value)}
        />
      </label>
      <span className={styles.customSizeSeparator} aria-hidden="true">
        ×
      </span>
      <label className={styles.customSizeField}>
        <span>Width (cm)</span>
        <input
          type="text"
          inputMode="decimal"
          value={widthInput}
          disabled={disabled}
          onFocus={() => setEditing('width')}
          onBlur={() => setEditing(null)}
          onChange={(e) => handleChange('width', e.target.value)}
        />
      </label>
      {aspectLocked && (
        <p className={styles.customSizeHint}>
          Width and height are locked to this artwork&apos;s aspect ratio — change either, the other
          follows.
        </p>
      )}
    </div>
  )
}

function formatCm(value: number, step: number): string {
  if (!Number.isFinite(value) || value === 0) return ''
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step))
  return value.toFixed(decimals)
}

// ── Border dimension (uniform) ──────────────────────────────────

interface BorderSectionProps {
  dimension: BorderDimension
  config: WizardConfig
  optionsLocked: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onBorderChange: (dimensionId: string, allCm: number) => void
}

const BorderDimensionSection = ({
  dimension,
  config,
  optionsLocked,
  open,
  onToggle,
  onBorderChange,
}: BorderSectionProps) => {
  const value = config.borders?.[dimension.id]?.allCm ?? dimension.defaultCm
  const decimals = dimension.stepCm >= 1 ? 0 : Math.ceil(-Math.log10(dimension.stepCm))
  // Strip trailing zeros so 0 → "0", 1.0 → "1", 0.3 stays "0.3".
  const displayed = parseFloat(value.toFixed(decimals)).toString()
  return (
    <CollapsibleSection title={dimension.label} open={open} onToggle={onToggle}>
      <div className={styles.stepField}>
        {dimension.helpText && (
          <p className={styles.destinationHelp}>{dimension.helpText}</p>
        )}
        <p className={styles.sliderValue}>{displayed} cm</p>
        <input
          type="range"
          className={styles.slider}
          min={dimension.minCm}
          max={dimension.maxCm}
          step={dimension.stepCm}
          value={value}
          disabled={optionsLocked}
          onChange={(e) =>
            onBorderChange(
              dimension.id,
              clampCm(
                Number(e.target.value),
                dimension.minCm,
                dimension.maxCm,
                dimension.stepCm,
              ),
            )
          }
        />
      </div>
    </CollapsibleSection>
  )
}

// ── Tooltip helper ───────────────────────────────────────────────

function optionTooltip(option: Option): ReactNode {
  if (!option.description) return undefined
  return (
    <>
      <p>
        <strong>{option.label}</strong>
      </p>
      <p>{option.description}</p>
    </>
  )
}
