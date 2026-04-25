'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'

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
  formatSize,
  getCompatibleSizes,
  getFormat,
  isSizePrintEligible,
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
  SizeOption,
} from './types'

import styles from './PrintWizard.module.scss'

interface StepsPanelProps {
  config: PrintConfig
  aspectRatio: number
  /** Pixel dimensions of the artwork's source image. Used to hide sizes
   *  the image physically can't print at 300 DPI. */
  originalWidthPx: number
  originalHeightPx: number
  onChange: (patch: Partial<PrintConfig>) => void
  countryCode: string
  onCountryChange: (code: string) => void
  catalogStatus: CatalogStatus
  /**
   * Countries list from localStorage (previous session). Used to populate
   * the destinations dropdown *while the full catalog is still loading*,
   * so a returning buyer sees a usable country picker instantly instead
   * of "Loading available destinations…".
   */
  fallbackCountries: string[] | null
  /** Artist-set restrictions for this artwork. null/undefined = no restrictions. */
  printOptions: PrintOptions | null
  /**
   * True when no combination of (ships-to-country) × (artist-allowed)
   * is available for the current selection. Parent flips this when both
   * `firstShippableConfig` and `findShippableConfig` return null.
   */
  noViableCombo: boolean
}

type StepKey = 'destination' | 'orientation' | 'paper' | 'format' | 'size' | 'frame' | 'mount'

const FORMAT_TOOLTIP_IMAGES: Partial<Record<FormatId, ReactNode>> = {
  'classic-framed': (
    <Image src="/assets/helpers/classic-frame.png" alt="" width={220} height={220} />
  ),
  'box-framed': <Image src="/assets/helpers/box-frame.png" alt="" width={220} height={220} />,
}

const FORMAT_TOOLTIPS: Record<FormatId, ReactNode> = {
  unframed: (
    <>
      <p>
        <strong>Unframed print</strong>
      </p>
      <p>
        Just the print on its own — no mount or frame. Delivered rolled in a protective tube so
        you can frame it locally or display it as-is.
      </p>
    </>
  ),
  'classic-framed': (
    <>
      <p>
        <strong>Classic frame</strong>
      </p>
      <p>
        A slim, flush wooden moulding with Perspex glazing — ready to hang. The print sits behind
        the glass for a clean, gallery-ready finish that suits any interior.
      </p>
    </>
  ),
  'box-framed': (
    <>
      <p>
        <strong>Box frame</strong>
      </p>
      <p>
        Crafted from solid, hand-stained wood and finished with a premium fine art print, our box
        framed prints measure 20mm on the front face, with a 33mm depth from the wall for a
        clean, contemporary shadow-line look. A specialist wax finish brings out the natural
        grain and warmth of the wood.
      </p>
    </>
  ),
}

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
  originalWidthPx,
  originalHeightPx,
  onChange,
  countryCode,
  onCountryChange,
  catalogStatus,
  fallbackCountries,
  printOptions,
  noViableCombo,
}: StepsPanelProps) => {
  // Independent open/closed state per section — the buyer can have any
  // combination open. All sections start closed so the panel is compact on
  // first render; the user opens whichever step they want to adjust.
  const [openSteps, setOpenSteps] = useState<Set<StepKey>>(() => new Set())

  const toggle = (key: StepKey) => (open: boolean) => {
    setOpenSteps((prev) => {
      const next = new Set(prev)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
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

  const availablePapers = useMemo(
    () => allowedPapers.filter((p) => keepAvail('paper', p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, countryCode, catalog, allowedPapers],
  )
  const paperOptions: SelectOption<PaperId>[] = useMemo(
    () =>
      availablePapers.map((p) => ({
        value: p.id,
        label: p.label,
        tooltip: (
          <>
            <p>
              <strong>{p.label}</strong>
            </p>
            <p>{p.description}</p>
          </>
        ),
      })),
    [availablePapers],
  )
  const formatOptions: SelectOption<FormatId>[] = useMemo(
    () =>
      allowedFormats
        .filter((f) => keepAvail('format', f.id))
        .map((f) => ({
          value: f.id,
          label: f.label,
          tooltip: FORMAT_TOOLTIPS[f.id],
          tooltipImage: FORMAT_TOOLTIP_IMAGES[f.id],
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
    // Drop sizes the image physically can't print at 300 DPI — the
    // buyer shouldn't see an option that would yield an under-resolved
    // print, regardless of aspect fit or country coverage.
    const eligible = (s: SizeOption) => isSizePrintEligible(s, originalWidthPx, originalHeightPx)
    const perfect = filterSizesForArtwork(sizeGroups.perfect, printOptions).filter(eligible)
    const close = filterSizesForArtwork(sizeGroups.close, printOptions).filter(eligible)
    const mismatch = filterSizesForArtwork(sizeGroups.mismatch, printOptions).filter(eligible)
    // Labels follow the buyer's chosen orientation so "40×50 cm" flips
    // to "50×40 cm" when the print hangs landscape. formatSize returns
    // the dual "cm (in)" format — no extra wrapping needed.
    const formatLabel = (s: SizeOption) => formatSize(s, config.orientation)
    const fitTooltip = (
      <p>This size matches your artwork&apos;s aspect ratio — the whole image prints without cropping or padding.</p>
    )
    const cropPadTooltip = (
      <p>
        This size doesn&apos;t match your artwork&apos;s aspect ratio. To fit it we either trim the
        edges (crop) or add a white border (pad).
      </p>
    )
    const allSizes: SelectOption<SizeId>[] = []
    for (const s of perfect) {
      allSizes.push({ value: s.id, label: formatLabel(s), tooltip: fitTooltip })
    }
    for (const s of close) {
      allSizes.push({ value: s.id, label: formatLabel(s), tooltip: fitTooltip })
    }
    for (const s of mismatch) {
      allSizes.push({ value: s.id, label: formatLabel(s), tooltip: cropPadTooltip })
    }
    return allSizes.filter((opt) => keepAvail('size', opt.value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeGroups, config, countryCode, catalog, printOptions, originalWidthPx, originalHeightPx])

  const countryOptions: SelectOption<string>[] = useMemo(() => {
    // Prefer the live catalog's countries; fall back to the persisted
    // list from a previous session so the dropdown is usable immediately
    // on a cold-cache deep-link.
    const available =
      catalogStatus.kind === 'ready' ? catalogStatus.countries : (fallbackCountries ?? [])
    return sortCountries(available).map((code) => ({
      value: code,
      label: countryName(code),
    }))
  }, [catalogStatus, fallbackCountries])

  const showCountryDropdown =
    catalogStatus.kind === 'ready' || (fallbackCountries && fallbackCountries.length > 0)

  return (
    <aside className={styles.stepsPanel}>
      <CollapsibleSection
        title="Destination"
        open={openSteps.has('destination')}
        onToggle={toggle('destination')}
      >
        <div className={styles.stepField}>
          <p className={styles.destinationHelp}>
            Pick your destination first. The options below will only show what we can actually ship
            to that country.
          </p>

          {catalogStatus.kind === 'loading' && !showCountryDropdown && (
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

          {showCountryDropdown && (
            <SelectDropdown<string>
              label="Country"
              options={countryOptions}
              value={countryCode}
              onChange={onCountryChange}
              placeholder="Choose a country…"
            />
          )}

          {showCountryDropdown && !countryCode && (
            <p className={styles.destinationNotice + ' ' + styles.destinationNoticeInfo}>
              Pick a destination to continue.
            </p>
          )}

          {/* No config satisfies both shipping AND artist's restrictions
              for this destination. Show a clear message and stop — the
              Continue button is already disabled upstream via canContinue. */}
          {catalogStatus.kind === 'ready' && countryCode && noViableCombo && (
            <p className={styles.destinationNotice}>
              Sorry — this artwork isn&apos;t currently available for shipping to{' '}
              {countryName(countryCode)}. Try a different destination.
            </p>
          )}
        </div>
      </CollapsibleSection>

      {!noViableCombo && (
        <>
          <CollapsibleSection title="Size" open={openSteps.has('size')} onToggle={toggle('size')}>
            <div className={styles.stepField}>
              <SelectDropdown<SizeId>
                label="Artwork size"
                options={sizeOptions}
                value={config.sizeId}
                onChange={(v) => onChange({ sizeId: v })}
                disabled={optionsLocked}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Paper"
            open={openSteps.has('paper')}
            onToggle={toggle('paper')}
          >
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

          <CollapsibleSection
            title="Format"
            open={openSteps.has('format')}
            onToggle={toggle('format')}
          >
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

          {isFramed && (
            <CollapsibleSection
              title="Frame"
              open={openSteps.has('frame')}
              onToggle={toggle('frame')}
            >
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
            <CollapsibleSection
              title="Mount"
              open={openSteps.has('mount')}
              onToggle={toggle('mount')}
            >
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

          <CollapsibleSection
            title="Orientation"
            open={openSteps.has('orientation')}
            onToggle={toggle('orientation')}
          >
            <div className={styles.stepField}>
              <p className={styles.destinationHelp}>
                How the print will be hung. Defaulted to match your artwork — you can flip it if you
                want a different hang.
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
        </>
      )}
    </aside>
  )
}
