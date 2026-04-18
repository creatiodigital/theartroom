'use client'

import { useMemo, useState } from 'react'

import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { Icon } from '@/components/ui/Icon'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import type { SelectOption } from '@/components/ui/SelectDropdown'

import type { CatalogStatus } from './index'
import {
  canSwap,
  filterFormatsForArtwork,
  filterFrameColorsForArtwork,
  filterMountsForArtwork,
  filterPapersForArtwork,
  filterSizesForArtwork,
  getCompatibleSizes,
  getFormat,
} from './options'
import type {
  FormatId,
  FrameColorId,
  MountId,
  Orientation,
  PaperId,
  PrintConfig,
  PrintOptions,
  SizeId,
} from './types'

import styles from './PrintWizard.module.scss'

interface StepsPanelProps {
  config: PrintConfig
  aspectRatio: number
  onChange: (patch: Partial<PrintConfig>) => void
  countryCode: string
  onCountryChange: (code: string) => void
  catalogStatus: CatalogStatus
  /** Artist-set restrictions for this artwork. null/undefined = no restrictions. */
  printOptions: PrintOptions | null
}

type StepKey = 'paper' | 'format' | 'size' | 'frame' | 'mount'

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
const countryName = (code: string) => regionNames?.of(code) ?? code
const sortCountries = (codes: string[]) =>
  [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b)))

export const StepsPanel = ({
  config,
  aspectRatio,
  onChange,
  countryCode,
  onCountryChange,
  catalogStatus,
  printOptions,
}: StepsPanelProps) => {
  const [openStep, setOpenStep] = useState<StepKey>('paper')

  const toggle = (key: StepKey) => (open: boolean) => {
    if (open) setOpenStep(key)
  }

  const isFramed = getFormat(config.formatId).framed

  // Filter sizes by aspect ratio, ordered best-fit first. The "will crop or
  // pad" suffix on mismatched ratios is enough hint — no toggle needed.
  const sizeGroups = useMemo(() => getCompatibleSizes(aspectRatio), [aspectRatio])

  // Per-artwork restrictions come before the Prodigi-availability filter:
  // whatever the artist banned is just gone, no grey-out, no surprise.
  const allowedPapers = useMemo(() => filterPapersForArtwork(printOptions), [printOptions])
  const allowedFormats = useMemo(() => filterFormatsForArtwork(printOptions), [printOptions])
  const allowedFrameColors = useMemo(
    () => filterFrameColorsForArtwork(printOptions),
    [printOptions],
  )
  const allowedMounts = useMemo(() => filterMountsForArtwork(printOptions), [printOptions])

  const catalog = catalogStatus.kind === 'ready' ? catalogStatus.catalog : null

  // Option dropdowns are locked until (a) the catalog is loaded AND (b) the
  // user has picked a destination. Before either, picking options would be
  // meaningless — we can't tell them what ships where yet.
  const optionsLocked = catalogStatus.kind !== 'ready' || !countryCode

  // Before a country is picked we show every option. After the user picks,
  // we filter the lists so only shippable values appear — no grey-out
  // states to parse, no banners, just a clean set of choices that work.
  const keepAvail = <V extends string>(
    dimension: 'paper' | 'format' | 'size' | 'frame' | 'mount',
    value: V,
  ) => !catalog || !countryCode || canSwap(config, dimension, value, countryCode, catalog)

  const paperOptions: SelectOption<PaperId>[] = useMemo(
    () =>
      allowedPapers
        .filter((p) => keepAvail('paper', p.id))
        .map((p) => ({
          value: p.id,
          label: p.label,
          description: p.description,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, countryCode, catalog, allowedPapers],
  )
  const formatOptions: SelectOption<FormatId>[] = useMemo(
    () =>
      allowedFormats
        .filter((f) => keepAvail('format', f.id))
        .map((f) => ({
          value: f.id,
          label: f.label,
          description: f.description,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, countryCode, catalog, allowedFormats],
  )
  const frameColorOptions: SelectOption<FrameColorId>[] = useMemo(
    () =>
      allowedFrameColors
        .filter((c) => keepAvail('frame', c.id))
        .map((c) => ({
          value: c.id,
          label: c.label,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, countryCode, catalog, allowedFrameColors],
  )
  const mountOptions: SelectOption<MountId>[] = useMemo(
    () =>
      allowedMounts
        .filter((m) => keepAvail('mount', m.id))
        .map((m) => ({ value: m.id, label: m.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, countryCode, catalog, allowedMounts],
  )
  const sizeOptions: SelectOption<SizeId>[] = useMemo(() => {
    const allSizes: SelectOption<SizeId>[] = []
    const perfect = filterSizesForArtwork(sizeGroups.perfect, printOptions)
    const close = filterSizesForArtwork(sizeGroups.close, printOptions)
    const mismatch = filterSizesForArtwork(sizeGroups.mismatch, printOptions)
    for (const s of perfect) allSizes.push({ value: s.id, label: s.label })
    for (const s of close) allSizes.push({ value: s.id, label: s.label })
    for (const s of mismatch) {
      allSizes.push({ value: s.id, label: `${s.label} — will crop or pad` })
    }
    return allSizes.filter((opt) => keepAvail('size', opt.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeGroups, config, countryCode, catalog, printOptions])

  const countryOptions: SelectOption<string>[] = useMemo(() => {
    const available = catalogStatus.kind === 'ready' ? catalogStatus.countries : []
    return sortCountries(available).map((code) => ({
      value: code,
      label: countryName(code),
    }))
  }, [catalogStatus])

  return (
    <aside className={styles.stepsPanel}>
      <div className={styles.destinationBlock}>
        <div className={styles.destinationHeader}>
          <span className={styles.destinationTitle}>Shipping destination</span>
          <span className={styles.destinationRequired}>Required</span>
        </div>
        <p className={styles.destinationHelp}>
          Pick your destination first. The options below will only show what we can actually ship to
          that country — so anything you see is available for you.
        </p>

        {catalogStatus.kind === 'loading' && (
          <p
            className={
              styles.destinationNotice +
              ' ' +
              styles.destinationNoticeInfo +
              ' ' +
              styles.destinationNoticeWithSpinner
            }
          >
            <span>Loading available destinations…</span>
            <span className={styles.spinner} aria-hidden="true">
              <Icon name="loaderCircle" size={16} />
            </span>
          </p>
        )}

        {catalogStatus.kind === 'error' && (
          <p className={styles.destinationNotice}>
            Couldn&apos;t load destinations right now. Please try again in a moment.
          </p>
        )}

        {catalogStatus.kind === 'ready' && (
          <div className={styles.stepField}>
            <SelectDropdown<string>
              label="Country"
              options={countryOptions}
              value={countryCode}
              onChange={onCountryChange}
              placeholder="Choose a country…"
            />
          </div>
        )}

        {catalogStatus.kind === 'ready' && !countryCode && (
          <p className={styles.destinationNotice + ' ' + styles.destinationNoticeInfo}>
            Pick a destination to continue.
          </p>
        )}
      </div>

      <div className={styles.orientationBlock}>
        <div className={styles.destinationHeader}>
          <span className={styles.destinationTitle}>Orientation</span>
        </div>
        <p className={styles.destinationHelp}>
          How the print will be hung. Defaulted to match your artwork — you can flip it if you want
          a different hang.
        </p>
        <div className={styles.orientationChoices} role="radiogroup" aria-label="Orientation">
          {(['portrait', 'landscape'] as Orientation[]).map((value) => {
            const selected = config.orientation === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`${styles.orientationChoice} ${
                  selected ? styles.orientationChoiceSelected : ''
                }`}
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

      <CollapsibleSection title="Paper" open={openStep === 'paper'} onToggle={toggle('paper')}>
        <div className={styles.stepField}>
          <SelectDropdown<PaperId>
            label="Paper tier"
            options={paperOptions}
            value={config.paperId}
            onChange={(v) => onChange({ paperId: v })}
            disabled={optionsLocked}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Format" open={openStep === 'format'} onToggle={toggle('format')}>
        <div className={styles.stepField}>
          <SelectDropdown<FormatId>
            label="Format"
            options={formatOptions}
            value={config.formatId}
            onChange={(v) => onChange({ formatId: v })}
            disabled={optionsLocked}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Size" open={openStep === 'size'} onToggle={toggle('size')}>
        <div className={styles.stepField}>
          <SelectDropdown<SizeId>
            label="Size"
            options={sizeOptions}
            value={config.sizeId}
            onChange={(v) => onChange({ sizeId: v })}
            disabled={optionsLocked}
          />
        </div>
      </CollapsibleSection>

      {isFramed && (
        <CollapsibleSection title="Frame" open={openStep === 'frame'} onToggle={toggle('frame')}>
          <div className={styles.stepField}>
            <SelectDropdown<FrameColorId>
              label="Frame color"
              options={frameColorOptions}
              value={config.frameColorId}
              onChange={(v) => onChange({ frameColorId: v })}
              disabled={optionsLocked}
            />
          </div>
        </CollapsibleSection>
      )}

      {isFramed && (
        <CollapsibleSection title="Mount" open={openStep === 'mount'} onToggle={toggle('mount')}>
          <div className={styles.stepField}>
            <SelectDropdown<MountId>
              label="Passepartout"
              options={mountOptions}
              value={config.mountId}
              onChange={(v) => onChange({ mountId: v })}
              disabled={optionsLocked}
            />
          </div>
        </CollapsibleSection>
      )}
    </aside>
  )
}
