'use client'

import { useId, useMemo } from 'react'
import { Check } from '@phosphor-icons/react'
import c from 'classnames'

import {
  type AvailabilityCheck,
  type EnumDimension,
  type Option,
  type PrintRestrictions,
  type WizardConfig,
  isOptionPickable,
} from '@/lib/print-providers'

import styles from './ChoiceControls.module.scss'

/**
 * The configurator's choices drawn as the order-flow designs draw them (order-flow.md "Frame"):
 * a two-way switch, photo cards, option rows with their descriptions written in, chips, and the
 * moulding as colour swatches + profile chips. All are native radios over the SAME options the
 * dropdown offered (the same `isOptionPickable` filter) and send the same `{ [dim.id]: id }`
 * patch: only the look changes.
 */

type ChoiceProps = {
  dim: EnumDimension
  config: WizardConfig
  countryCode: string
  availability: AvailabilityCheck
  restrictions: PrintRestrictions | null
  optionsLocked: boolean
  onChange: (patch: Record<string, string>) => void
}

export type ChoiceLook = 'segmented' | 'cards' | 'list' | 'chips'

const usePickable = ({ dim, config, countryCode, availability, restrictions }: ChoiceProps) =>
  useMemo(
    () =>
      dim.options.filter((option) =>
        isOptionPickable(option, {
          dimensionId: dim.id,
          config,
          country: countryCode,
          availability,
          restrictions,
        }),
      ),
    [dim, config, countryCode, availability, restrictions],
  )

function Group({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className={c(styles.group, className)}>
      <legend className={styles.legend}>{label}</legend>
      {children}
    </fieldset>
  )
}

/** One radio, visually hidden; its <label> is the card, row or chip. */
function Radio({
  name,
  option,
  checked,
  disabled,
  onSelect,
}: {
  name: string
  option: Option
  checked: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <input
      type="radio"
      className={styles.radio}
      name={name}
      value={option.id}
      checked={checked}
      disabled={disabled}
      onChange={onSelect}
    />
  )
}

export function EnumChoice(props: ChoiceProps & { look: ChoiceLook }) {
  const { dim, config, optionsLocked, onChange, look } = props
  const options = usePickable(props)
  const name = useId()
  const value = config.values[dim.id] ?? ''
  const chosen = options.find((option) => option.id === value)

  return (
    <Group label={dim.label}>
      <div className={c(styles.options, styles[look])}>
        {options.map((option) => {
          const checked = option.id === value
          const image = option.tooltipHeaderImageUrl ?? option.tooltipImageUrl
          return (
            <label
              key={option.id}
              className={c(
                styles.option,
                checked && styles.checked,
                optionsLocked && styles.locked,
              )}
            >
              <Radio
                name={name}
                option={option}
                checked={checked}
                disabled={optionsLocked}
                onSelect={() => onChange({ [dim.id]: option.id })}
              />
              {look === 'cards' && image && (
                // A catalog helper photo; plain <img>, as the tooltips used them.
                <img src={image} alt="" className={styles.cardImage} />
              )}
              {look === 'list' && <span className={styles.dot} aria-hidden />}
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>
                  {option.label}
                  {look === 'cards' && checked && <Check size={14} weight="bold" aria-hidden />}
                </span>
                {look === 'list' && option.description && (
                  <span className={styles.optionDescription}>{option.description}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
      {/* The switch and the cards say what the chosen option is, under them. */}
      {(look === 'segmented' || look === 'cards') && chosen?.description && (
        <p className={styles.note}>
          {look === 'cards' && <b>{chosen.label}. </b>}
          {chosen.description}
        </p>
      )}
    </Group>
  )
}

// The moulding's options are "Colour — Profile" pairs ("White — Thin"). Drawn as two choices over
// the same option ids: a colour swatch and a profile chip; changing one keeps the other when that
// pair exists, else takes the first pair of the new colour (or profile).
const SEPARATOR = /\s+[—–-]\s+/
const SWATCHES: Record<string, string> = {
  white: '#f2f2f2',
  black: '#111111',
  oak: '#c49a6c',
  walnut: '#6b4a33',
  beech: '#e2c9a3',
  silver: '#c7c9cc',
  gold: '#c9a24b',
}

export function MouldingChoice(props: ChoiceProps) {
  const { dim, config, optionsLocked, onChange } = props
  const options = usePickable(props)
  const name = useId()
  const value = config.values[dim.id] ?? ''

  const pairs = options.map((option) => {
    const [colour, profile] = option.label.split(SEPARATOR)
    return { option, colour: colour?.trim() ?? option.label, profile: profile?.trim() ?? '' }
  })
  // Labels that don't split: the plain chips, as any other choice.
  if (pairs.some((pair) => !pair.profile)) return <EnumChoice {...props} look="chips" />

  const current = pairs.find((pair) => pair.option.id === value)
  const colours = [...new Set(pairs.map((pair) => pair.colour))]
  const profiles = [
    ...new Set(pairs.filter((pair) => pair.colour === current?.colour).map((p) => p.profile)),
  ]
  const pick = (colour: string, profile: string) => {
    const exact = pairs.find((pair) => pair.colour === colour && pair.profile === profile)
    const fallback = pairs.find((pair) => pair.colour === colour)
    const next = exact ?? fallback
    if (next) onChange({ [dim.id]: next.option.id })
  }

  return (
    <Group label={dim.label}>
      <div className={styles.swatches} role="radiogroup" aria-label={`${dim.label} colour`}>
        {colours.map((colour) => {
          const checked = current?.colour === colour
          return (
            <label key={colour} className={c(styles.swatch, checked && styles.checked)}>
              <input
                type="radio"
                className={styles.radio}
                name={`${name}-colour`}
                checked={checked}
                disabled={optionsLocked}
                onChange={() => pick(colour, current?.profile ?? '')}
              />
              <span
                className={styles.swatchDot}
                style={{ background: SWATCHES[colour.toLowerCase()] ?? 'var(--color-gray-35)' }}
                aria-hidden
              />
              {colour}
            </label>
          )
        })}
      </div>
      <div
        className={c(styles.options, styles.chips)}
        role="radiogroup"
        aria-label={`${dim.label} profile`}
      >
        {profiles.map((profile) => {
          const checked = current?.profile === profile
          return (
            <label key={profile} className={c(styles.option, checked && styles.checked)}>
              <input
                type="radio"
                className={styles.radio}
                name={`${name}-profile`}
                checked={checked}
                disabled={optionsLocked}
                onChange={() => pick(current?.colour ?? colours[0], profile)}
              />
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{profile}</span>
              </span>
            </label>
          )
        })}
      </div>
    </Group>
  )
}
