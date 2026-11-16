'use client'

import { useRef, type KeyboardEvent } from 'react'
import c from 'classnames'

import { PanelCard, SliderRow, SwitchRow } from '@/components/editorChrome'
import { NumberField, SegmentStrip } from '@/components/wallview/chrome'
import { Button } from '@/components/ui/Button'
import {
  LIGHTBOX_BRIGHTNESS,
  LIGHTBOX_DEPTH,
  LIGHTBOX_SWATCH,
  type TLightbox,
  type TLightboxEdge,
  type TLightboxFront,
  type TLightboxLight,
  type TLightboxMaterial,
} from '@/lib/lightbox'
import type { TArtwork } from '@/types/artwork'

import styles from './PresentationSection.module.scss'

// docs/lightbox/designs/lightbox.dc.html, "Lightbox on". Labels in American spelling.
const LIGHTS: { value: TLightboxLight; label: string; dot: string }[] = [
  { value: 'warm', label: 'Warm', dot: '#ffd9a8' },
  { value: 'neutral', label: 'Neutral', dot: '#fbf8f0' },
  { value: 'cool', label: 'Cool', dot: '#dde8ff' },
]

const EDGES: { value: TLightboxEdge; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'thin', label: 'Thin' },
  { value: 'wide', label: 'Wide' },
]

const MATERIALS: { value: TLightboxMaterial; label: string }[] = [
  { value: 'alu-black', label: 'Black aluminum' },
  { value: 'alu-silver', label: 'Silver aluminum' },
  { value: 'white', label: 'White' },
  { value: 'oak', label: 'Oak' },
  { value: 'walnut', label: 'Walnut' },
]

const FRONTS: { value: TLightboxFront; label: string }[] = [
  { value: 'matte', label: 'Matte' },
  { value: 'glossy', label: 'Glossy' },
]

const MOVE_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']

type LightboxCardProps = {
  lightbox: TLightbox
  onEdit: <K extends keyof TArtwork>(property: K, value: TArtwork[K]) => void
  disabled?: boolean
}

/**
 * The Look tab's first card for an image (docs/lightbox "Where the artist sets it"): the
 * Lightbox switch and, while on, its settings in the same card, outlined.
 */
export function LightboxCard({ lightbox, onEdit, disabled }: LightboxCardProps) {
  const on = lightbox.showLightbox

  return (
    <PanelCard level="card" outlined={on}>
      <SwitchRow
        title="Lightbox"
        line="Lit from behind, in a shallow box"
        checked={on}
        onChange={(e) => onEdit('showLightbox', e.target.checked)}
        disabled={disabled}
      />
      {on && (
        <>
          <SliderRow
            label="Brightness"
            value={`${Math.round(lightbox.lightboxBrightness * 100)}%`}
            hideValue
            ends={['Soft', 'Bright']}
            sliderValue={lightbox.lightboxBrightness}
            min={LIGHTBOX_BRIGHTNESS.min}
            max={LIGHTBOX_BRIGHTNESS.max}
            step={0.01}
            onChange={(v) => onEdit('lightboxBrightness', v)}
            disabled={disabled}
          />

          <div className={styles.field}>
            <span className={styles.caption}>Light color</span>
            <SegmentStrip
              label="Light color"
              segments={LIGHTS.map(({ value, label, dot }) => ({
                key: value,
                label,
                dot,
                pressed: lightbox.lightboxLight === value,
                onClick: () => onEdit('lightboxLight', value),
                disabled,
              }))}
            />
          </div>

          <div className={styles.depthEdge}>
            <div className={styles.depth}>
              <NumberField
                label="Depth"
                value={lightbox.lightboxDepth}
                suffix="cm"
                min={LIGHTBOX_DEPTH.min}
                max={LIGHTBOX_DEPTH.max}
                // Kept in 3–15 while typing ("1" on the way to "12" reads as 3 until the "2").
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (Number.isFinite(v)) {
                    onEdit(
                      'lightboxDepth',
                      Math.min(LIGHTBOX_DEPTH.max, Math.max(LIGHTBOX_DEPTH.min, v)),
                    )
                  }
                }}
                disabled={disabled}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.caption}>Edge</span>
              <SegmentStrip
                label="Edge"
                segments={EDGES.map(({ value, label }) => ({
                  key: value,
                  label,
                  pressed: lightbox.lightboxEdge === value,
                  onClick: () => onEdit('lightboxEdge', value),
                  disabled,
                }))}
              />
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.caption}>Material</span>
            <MaterialSwatches
              value={lightbox.lightboxMaterial}
              onChange={(value) => onEdit('lightboxMaterial', value)}
              disabled={disabled}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.caption}>Front</span>
            <SegmentStrip
              label="Front"
              segments={FRONTS.map(({ value, label }) => ({
                key: value,
                label,
                pressed: lightbox.lightboxFront === value,
                onClick: () => onEdit('lightboxFront', value),
                disabled,
              }))}
            />
          </div>
        </>
      )}
    </PanelCard>
  )
}

/**
 * The five materials as swatches, one picked (the radio pattern: one tab stop, the arrows and
 * Home / End move and pick; stopped here so the wall never nudges the work on them).
 */
function MaterialSwatches({
  value,
  onChange,
  disabled,
}: {
  value: TLightboxMaterial
  onChange: (value: TLightboxMaterial) => void
  disabled?: boolean
}) {
  const groupRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!MOVE_KEYS.includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    const from = Math.max(
      0,
      MATERIALS.findIndex((m) => m.value === value),
    )
    const last = MATERIALS.length - 1
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? (from + 1) % MATERIALS.length
            : (from - 1 + MATERIALS.length) % MATERIALS.length
    onChange(MATERIALS[next].value)
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Material"
      className={styles.swatches}
      onKeyDown={onKeyDown}
    >
      {MATERIALS.map((material) => {
        const checked = material.value === value
        return (
          <Button
            key={material.value}
            variant="bare"
            font="dashboard"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={c(styles.swatch, checked && styles.picked)}
            onClick={() => checked || onChange(material.value)}
            disabled={disabled}
          >
            <span
              className={styles.chip}
              style={{ background: LIGHTBOX_SWATCH[material.value] }}
              aria-hidden
            />
            <span className={styles.name}>{material.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
