'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { ErrorText } from '@/components/ui/ErrorText'
import { Icon } from '@/components/ui/Icon'
import { ImageUploader } from '@/components/ui/ImageUploader'
import type { ImageMeta } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { Text } from '@/components/ui/Typography'
import { FORMATS, FRAME_COLORS, MOUNTS, PAPERS, SIZES } from '@/components/PrintWizard/options'
import type { PrintOptions } from '@/components/PrintWizard/types'
import { TPS_FRAME_TYPES, TPS_PAPERS, TPS_WINDOW_MOUNTS } from '@/lib/print-providers/printspace'
import type { PrintRestrictions } from '@/lib/print-providers'
import {
  MAX_ARTWORK_UPLOAD_SIZE,
  MIN_ARTWORK_IMAGE_WIDTH,
  MIN_ARTWORK_IMAGE_HEIGHT,
  MIN_PRINT_WIDTH,
  MIN_PRINT_HEIGHT,
} from '@/lib/imageConfig'

import dashboardStyles from '@/components/dashboard/DashboardLayout/DashboardLayout.module.scss'
import styles from './ArtworkEditForm.module.scss'

// Strip HTML tags from text content (for content saved with RichTextEditor previously)
export const stripHtml = (html: string): string => {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersands
    .replace(/&lt;/g, '<') // Replace less than
    .replace(/&gt;/g, '>') // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .trim()
}

export type Artwork = {
  id: string
  userId: string
  name: string
  artworkType: string
  title: string | null
  author: string | null
  year: string | null
  technique: string | null
  dimensions: string | null
  description: string | null
  imageUrl: string | null
  originalImageUrl: string | null
  originalDpi: number | null
  textContent: string | null
  soundUrl: string | null
  featured: boolean
  hiddenFromExhibition: boolean
  printEnabled?: boolean
  printPriceCents?: number | null
  /**
   * Which fulfillment service this artwork's prints route to. Stored
   * as the Prisma enum (PRODIGI | PRINTSPACE). Defaults to PRODIGI on
   * the server side so existing rows behave unchanged.
   */
  printProvider?: 'PRODIGI' | 'PRINTSPACE' | null
  /**
   * Artist-set veto/allow-list for printing options. Shape depends on
   * `printProvider`:
   *   - PRODIGI:    typed `PrintOptions` (allowedPaperIds, …)
   *   - PRINTSPACE: canonical `PrintRestrictions` ({ allowed: { dimId: ids[] } })
   * Stored as JSON; the page route + payment-intent re-check both
   * branch on provider before interpreting.
   */
  printOptions?: PrintOptions | PrintRestrictions | null
}

export type ArtworkFormData = {
  name: string
  artworkType: string
  title: string
  author: string
  year: string
  technique: string
  dimensions: string
  description: string
  textContent: string
  featured: boolean
  hiddenFromExhibition: boolean
  printEnabled: boolean
  /** Euros as a string for the input field; converted to cents at submit. */
  printPriceEuros: string
  /** Fulfillment service this artwork's prints route to. */
  printProvider: 'PRODIGI' | 'PRINTSPACE'
  /**
   * Artist-set restrictions. Shape varies with `printProvider`:
   *   - PRODIGI:    PrintOptions (allowedPaperIds, …)
   *   - PRINTSPACE: PrintRestrictions ({ allowed: { dimId: ids[] } })
   * `null` = no restrictions (all options offered).
   */
  printOptions: PrintOptions | PrintRestrictions | null
}

export const getInitialFormData = (): ArtworkFormData => ({
  name: '',
  artworkType: 'image',
  title: '',
  author: '',
  year: '',
  technique: '',
  dimensions: '',
  description: '',
  textContent: '',
  featured: false,
  hiddenFromExhibition: false,
  printEnabled: false,
  printPriceEuros: '',
  printProvider: 'PRODIGI',
  printOptions: null,
})

export const populateFormData = (data: Artwork): ArtworkFormData => ({
  name: data.name || '',
  artworkType: data.artworkType || 'image',
  title: data.title || '',
  author: data.author || '',
  year: data.year || '',
  technique: data.technique || '',
  dimensions: data.dimensions || '',
  description: data.description || '',
  textContent: stripHtml(data.textContent || ''),
  featured: data.featured ?? false,
  hiddenFromExhibition: data.hiddenFromExhibition ?? false,
  printEnabled: data.printEnabled ?? false,
  printPriceEuros:
    typeof data.printPriceCents === 'number' ? (data.printPriceCents / 100).toString() : '',
  printProvider: data.printProvider ?? 'PRODIGI',
  printOptions: data.printOptions ?? null,
})

type ArtworkEditFormProps = {
  formData: ArtworkFormData
  imageUrl: string | null
  imageDpi?: number | null
  originalWidth?: number | null
  originalHeight?: number | null
  originalImageUrl?: string | null
  originalFormat?: string | null
  originalSizeBytes?: number | null
  soundUrl?: string | null
  videoUrl?: string | null
  uploading: boolean
  loadingText?: string
  saving: boolean
  error: string
  onFormChange: (field: string, value: string | boolean) => void
  /** Replace the whole printOptions object. Called as the artist (un)checks boxes. */
  onPrintOptionsChange?: (next: PrintOptions | PrintRestrictions | null) => void
  onImageUpload: (file: File) => Promise<void>
  onImageRemove: () => void | Promise<void>
  onSoundUpload?: (file: File) => Promise<void>
  onSoundRemove?: () => void | Promise<void>
  onVideoUpload?: (file: File) => Promise<void>
  onVideoRemove?: () => void | Promise<void>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

const ALLOWED_SOUND_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/flac',
]
const MAX_SOUND_SIZE = 3 * 1024 * 1024 // 3MB

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']
const MAX_VIDEO_SIZE = 50 * 1024 * 1024 // 50MB

// Unified minimum DPI for print quality across providers. We hold a
// single bar — 300 DPI, the conventional fine-art-print threshold — so
// the artist's eligibility experience doesn't change when they switch
// service. The only meaningful difference between providers stays the
// supported file format (TPS: +TIFF).
const MIN_DPI = 300

// Per-provider accepted image formats. Prodigi: JPG/PNG (PDF too, but
// our display pipeline doesn't render PDFs as artwork previews so we
// don't expose it here). TPS: JPG/PNG/TIFF.
//
// Intersection (works for both): JPG, PNG.
// TIFF is TPS-only — uploading TIFF locks the artist into TPS until
// they re-upload. The form warns when the picked provider can't print
// the current image's format so they can either switch back or upload
// a compatible file.
const PROVIDER_ACCEPTED_FORMATS: Record<'PRODIGI' | 'PRINTSPACE', readonly string[]> = {
  PRODIGI: ['JPEG', 'PNG'],
  PRINTSPACE: ['JPEG', 'PNG', 'TIFF'],
}

const PROVIDER_DISPLAY_NAME: Record<'PRODIGI' | 'PRINTSPACE', string> = {
  PRODIGI: 'Prodigi',
  PRINTSPACE: 'The Print Space',
}

function isImageFormatCompatible(
  format: string | undefined | null,
  provider: 'PRODIGI' | 'PRINTSPACE',
): boolean {
  if (!format) return true
  const upper = format.toUpperCase()
  // Skip the placeholder fallback used when we don't have a real
  // format on hand (e.g. legacy artworks pre-format-tracking) — we'd
  // rather miss a warning than show a false one.
  if (upper === 'IMAGE') return true
  return PROVIDER_ACCEPTED_FORMATS[provider].includes(upper)
}

// Gate-level check used before the artist has picked a provider: is
// this format printable by *any* provider? Mainly catches legacy
// artworks uploaded before the JPG/PNG/TIFF restriction (e.g. WebP)
// where neither provider can fulfil orders.
function isImageFormatPrintable(format: string | undefined | null): boolean {
  if (!format) return true
  const upper = format.toUpperCase()
  if (upper === 'IMAGE') return true
  return (
    PROVIDER_ACCEPTED_FORMATS.PRODIGI.includes(upper) ||
    PROVIDER_ACCEPTED_FORMATS.PRINTSPACE.includes(upper)
  )
}

type PrintSizeEligibility = {
  label: string
  widthCm: number
  heightCm: number
  requiredWidth: number
  requiredHeight: number
  eligible: boolean
  effectiveDpiW: number
  effectiveDpiH: number
}

// Output is height × width (art-gallery convention). Args still take
// (widthCm, heightCm) so callers don't have to swap their fields.
function cmToInchLabel(widthCm: number, heightCm: number): string {
  const w = (widthCm / 2.54).toFixed(1)
  const h = (heightCm / 2.54).toFixed(1)
  return `${h}×${w} in`
}

function getPrintSizeEligibility(meta: ImageMeta | null, minDpi: number): PrintSizeEligibility[] {
  return SIZES.map((size) => {
    const requiredWidth = Math.ceil((size.widthCm / 2.54) * minDpi)
    const requiredHeight = Math.ceil((size.heightCm / 2.54) * minDpi)
    const printWidthInches = size.widthCm / 2.54
    const printHeightInches = size.heightCm / 2.54
    const effectiveDpiW = meta ? Math.round(meta.width / printWidthInches) : 0
    const effectiveDpiH = meta ? Math.round(meta.height / printHeightInches) : 0
    const eligible = meta ? meta.width >= requiredWidth && meta.height >= requiredHeight : false
    return {
      label: size.label,
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      requiredWidth,
      requiredHeight,
      eligible,
      effectiveDpiW,
      effectiveDpiH,
    }
  })
}

function isPrintEligible(meta: ImageMeta | null, minDpi: number): boolean {
  if (!meta) return false
  return getPrintSizeEligibility(meta, minDpi).some((s) => s.eligible)
}

/**
 * SIZES filtered to only those the current image can physically render
 * at the unified minimum DPI. Used to scope the Prodigi artist
 * restriction UI — it doesn't make sense to offer a checkbox for a
 * size the image can't fulfil. (TPS has no preset sizes, so this list
 * is Prodigi-specific.)
 */
function getEligibleSizes(meta: ImageMeta | null) {
  if (!meta) return SIZES
  return SIZES.filter((size) => {
    const requiredWidth = Math.ceil((size.widthCm / 2.54) * MIN_DPI)
    const requiredHeight = Math.ceil((size.heightCm / 2.54) * MIN_DPI)
    return meta.width >= requiredWidth && meta.height >= requiredHeight
  })
}

/**
 * TPS supports any custom size respecting the artwork's aspect ratio.
 * To show the artist where the resolution starts breaking down, we
 * sample a series of common long-edge values and compute the matching
 * aspect-locked short edge + effective DPI for each. Eligibility =
 * effective DPI ≥ MIN_DPI.
 *
 * Long edges chosen to span TPS's 10–150 cm slider range with
 * meaningful intervals — gives the artist a clear sense of "up to
 * about this size, prints stay sharp".
 */
const TPS_LONG_EDGE_SAMPLES_CM = [20, 30, 40, 50, 60, 80, 100, 120, 150]

type TpsSizeSample = {
  label: string
  widthCm: number
  heightCm: number
  effectiveDpi: number
  eligible: boolean
}

function getTpsSizeSamples(meta: ImageMeta | null): TpsSizeSample[] {
  if (!meta || meta.width <= 0 || meta.height <= 0) return []
  const longEdgePx = Math.max(meta.width, meta.height)
  const shortEdgePx = Math.min(meta.width, meta.height)
  const aspect = shortEdgePx / longEdgePx // ≤ 1
  const imageIsPortrait = meta.height > meta.width
  return TPS_LONG_EDGE_SAMPLES_CM.map((longEdgeCm) => {
    const shortEdgeCm = Math.round(longEdgeCm * aspect)
    const widthCm = imageIsPortrait ? shortEdgeCm : longEdgeCm
    const heightCm = imageIsPortrait ? longEdgeCm : shortEdgeCm
    // Effective DPI is min of the two axes — use the long edge since
    // the short edge follows from it via the locked aspect ratio.
    const effectiveDpi = Math.round(longEdgePx / (longEdgeCm / 2.54))
    return {
      label: `${heightCm}×${widthCm} cm (${cmToInchLabel(widthCm, heightCm)})`,
      widthCm,
      heightCm,
      effectiveDpi,
      eligible: effectiveDpi >= MIN_DPI,
    }
  })
}

/**
 * Acceptable aspect-ratio error margin between the artwork and a
 * Prodigi preset before we consider the preset unsuitable.
 *
 * 5% is a deliberate ceiling — beyond this, the visible edge crop is
 * perceptible (a few mm shaved off either dimension). Within 5% the
 * crop is sub-millimetre on most prints and visually indistinguishable
 * from a perfect fit. We stop showing presets past this threshold
 * because the gallery's promise is "no crop, no pad — ever".
 *
 * Tighten to e.g. 2% if you want only literal-perfect fits; loosen
 * past 5% would be visible cropping (not acceptable).
 */
const PRODIGI_ASPECT_FIT_TOLERANCE = 0.05

/**
 * True when at least one Prodigi preset size both fits within the
 * tolerance above AND has enough resolution for this image. When
 * false, the artwork can't be sold via Prodigi — the artist UI
 * surfaces a banner nudging them toward TPS (which supports custom
 * sizes that always fit).
 */
function hasProdigiAspectFit(meta: ImageMeta | null): boolean {
  if (!meta || meta.width <= 0 || meta.height <= 0) return true
  const imageRatio = meta.width / meta.height
  const eligible = getEligibleSizes(meta)
  return eligible.some((size) => {
    // Compare both orientations — Prodigi's classic frame SKUs are
    // orientation-agnostic, so a portrait image fits a landscape
    // preset and vice-versa.
    const sizeRatioA = size.widthCm / size.heightCm
    const sizeRatioB = size.heightCm / size.widthCm
    const diffA = Math.abs(sizeRatioA - imageRatio) / imageRatio
    const diffB = Math.abs(sizeRatioB - imageRatio) / imageRatio
    return Math.min(diffA, diffB) <= PRODIGI_ASPECT_FIT_TOLERANCE
  })
}

/**
 * Toggle membership of `id` in the allow-list for one dimension of
 * `PrintOptions`. The UI convention: all-checked means "no restriction"
 * so we drop the allow-list entirely when that dimension ends up matching
 * every id in `all`. Mirror inverse: leaving zero checked reinstates all.
 */
function togglePrintOptionId<K extends keyof PrintOptions>(
  current: PrintOptions | null,
  key: K,
  id: string,
  all: readonly string[],
): PrintOptions | null {
  const currentList = current?.[key] as readonly string[] | undefined
  const effective = currentList && currentList.length > 0 ? [...currentList] : [...all]
  const idx = effective.indexOf(id)
  const next = idx === -1 ? [...effective, id] : effective.filter((x) => x !== id)

  // Artist has re-checked everything or unchecked everything: drop the
  // allow-list so the field reverts to "no restriction" (buyers see all).
  // Zero-length would otherwise mean "nothing allowed" which we treat as
  // the same as "no restriction" to prevent accidental total lockouts.
  const reachesAll = next.length === all.length
  const isEmpty = next.length === 0
  const shouldClearDimension = reachesAll || isEmpty

  const base: PrintOptions = { ...(current ?? {}) }
  if (shouldClearDimension) {
    delete base[key]
  } else {
    ;(base as Record<string, unknown>)[key as string] = next
  }

  // Drop the whole printOptions object when nothing remains restricted.
  const anyRestriction = Object.values(base).some(
    (v) => Array.isArray(v) && v.length > 0 && v.length < all.length,
  )
  return Object.keys(base).length === 0 ? null : anyRestriction ? base : null
}

function isDimensionChecked<K extends keyof PrintOptions>(
  opts: PrintOptions | null,
  key: K,
  id: string,
): boolean {
  const list = opts?.[key] as readonly string[] | undefined
  // No allow-list set → all options allowed → every checkbox is checked.
  if (!list || list.length === 0) return true
  return list.includes(id)
}

// ── TPS variants of the same helpers ────────────────────────────
// TPS uses the canonical `PrintRestrictions` shape (`{ allowed: {
// dimensionId: ids[] } }`) rather than Prodigi's flat typed fields.

function toggleTpsRestrictionId(
  current: PrintRestrictions | null,
  dimensionId: string,
  id: string,
  all: readonly string[],
): PrintRestrictions | null {
  const currentList = current?.allowed?.[dimensionId]
  const effective = currentList && currentList.length > 0 ? [...currentList] : [...all]
  const idx = effective.indexOf(id)
  const next = idx === -1 ? [...effective, id] : effective.filter((x) => x !== id)

  // All checked or zero checked → drop this dimension's allow-list.
  const reachesAll = next.length === all.length
  const isEmpty = next.length === 0
  const shouldClear = reachesAll || isEmpty

  const baseAllowed: Record<string, string[]> = { ...(current?.allowed ?? {}) }
  if (shouldClear) delete baseAllowed[dimensionId]
  else baseAllowed[dimensionId] = next

  return Object.keys(baseAllowed).length === 0 ? null : { allowed: baseAllowed }
}

function isTpsDimensionChecked(
  restrictions: PrintRestrictions | null,
  dimensionId: string,
  id: string,
): boolean {
  const list = restrictions?.allowed?.[dimensionId]
  if (!list || list.length === 0) return true
  return list.includes(id)
}

type PrintRestrictionGroupProps<K extends keyof PrintOptions> = {
  title: string
  all: Array<{ id: string; label: string }>
  allIds: readonly string[]
  dimensionKey: K
  options: PrintOptions | null
  onChange?: (next: PrintOptions | null) => void
}

const PrintRestrictionGroup = <K extends keyof PrintOptions>({
  title,
  all,
  allIds,
  dimensionKey,
  options,
  onChange,
}: PrintRestrictionGroupProps<K>) => {
  const handleToggle = (id: string) => {
    if (!onChange) return
    onChange(togglePrintOptionId(options, dimensionKey, id, allIds))
  }
  return (
    <div className={styles.printRestrictionGroup}>
      <h4 className={styles.printRestrictionGroupTitle}>{title}</h4>
      <div className={styles.printRestrictionChoices}>
        {all.map((item) => (
          <Checkbox
            key={item.id}
            checked={isDimensionChecked(options, dimensionKey, item.id)}
            onChange={() => handleToggle(item.id)}
            label={item.label}
          />
        ))}
      </div>
    </div>
  )
}

type TpsRestrictionGroupProps = {
  title: string
  all: Array<{ id: string; label: string }>
  allIds: readonly string[]
  dimensionId: string
  restrictions: PrintRestrictions | null
  onChange?: (next: PrintRestrictions | null) => void
}

const TpsRestrictionGroup = ({
  title,
  all,
  allIds,
  dimensionId,
  restrictions,
  onChange,
}: TpsRestrictionGroupProps) => {
  const handleToggle = (id: string) => {
    if (!onChange) return
    onChange(toggleTpsRestrictionId(restrictions, dimensionId, id, allIds))
  }
  return (
    <div className={styles.printRestrictionGroup}>
      <h4 className={styles.printRestrictionGroupTitle}>{title}</h4>
      <div className={styles.printRestrictionChoices}>
        {all.map((item) => (
          <Checkbox
            key={item.id}
            checked={isTpsDimensionChecked(restrictions, dimensionId, item.id)}
            onChange={() => handleToggle(item.id)}
            label={item.label}
          />
        ))}
      </div>
    </div>
  )
}

export const ArtworkEditForm = ({
  formData,
  imageUrl,
  imageDpi,
  originalWidth,
  originalHeight,
  originalFormat,
  originalSizeBytes,
  soundUrl,
  videoUrl,
  uploading,
  loadingText = 'Uploading...',
  saving,
  error,
  onFormChange,
  onPrintOptionsChange,
  onImageUpload,
  onImageRemove,
  onSoundUpload,
  onSoundRemove,
  onVideoUpload,
  onVideoRemove,
  onSubmit,
  onCancel,
}: ArtworkEditFormProps) => {
  const soundInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingSound, setIsDraggingSound] = useState(false)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [soundSizeError, setSoundSizeError] = useState<string | null>(null)
  const [videoSizeError, setVideoSizeError] = useState<string | null>(null)
  // If server has original file info, use that directly instead of reading from CDN image
  const serverMeta = useMemo<ImageMeta | null>(() => {
    if (originalWidth && originalHeight) {
      return {
        width: originalWidth,
        height: originalHeight,
        format: originalFormat ?? 'Image',
        sizeBytes: originalSizeBytes ?? 0,
        dpi: imageDpi ?? undefined,
      }
    }
    return null
  }, [originalWidth, originalHeight, originalFormat, originalSizeBytes, imageDpi])

  const [clientMeta, setClientMeta] = useState<ImageMeta | null>(null)
  const [showPrintInfoModal, setShowPrintInfoModal] = useState(false)

  // Server meta takes priority over client-detected meta
  const imageMeta = serverMeta ?? clientMeta

  // Unified DPI threshold for both providers — see MIN_DPI definition.
  const printEligible = isPrintEligible(imageMeta, MIN_DPI)
  const printSizes = getPrintSizeEligibility(imageMeta, MIN_DPI)
  const eligibleSizes = printSizes.filter((s) => s.eligible)
  // Actual SizeOption entries the image can physically print at — used
  // to scope the artist's restriction checkboxes for the Sizes group.
  const eligibleSizeOptions = getEligibleSizes(imageMeta)

  // Prodigi only sells presets that match the artwork's aspect ratio
  // (no crop / no pad). When none qualify, the artist needs TPS instead.
  const prodigiFits = hasProdigiAspectFit(imageMeta)

  // Whether the uploaded image's file format is supported by the
  // currently-selected provider (Prodigi: JPG/PNG, TPS: JPG/PNG/TIFF).
  // Drives the provider-section warning and the per-button disabled
  // state once the artist has opted in to print sales.
  const formatCompatible = isImageFormatCompatible(imageMeta?.format, formData.printProvider)

  // Gate-level format check: is the image format printable by *any*
  // provider? Used to disable the "Enable print sales" toggle for
  // legacy artworks (e.g. WebP from before the JPG/PNG/TIFF restriction)
  // where no provider can fulfil orders. New uploads always pass since
  // the upload pipeline rejects anything outside the union.
  const printableFormat = isImageFormatPrintable(imageMeta?.format)

  const handleImageMetaChange = useCallback((meta: ImageMeta | null) => {
    if (meta && meta.width > 0) {
      setClientMeta(meta)
    } else if (meta === null) {
      setClientMeta(null)
    }
  }, [])

  const handleSoundFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onSoundUpload) {
        if (file.size > MAX_SOUND_SIZE) {
          setSoundSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 3MB.`,
          )
          if (soundInputRef.current) soundInputRef.current.value = ''
          return
        }
        setSoundSizeError(null)
        await onSoundUpload(file)
      }
      if (soundInputRef.current) soundInputRef.current.value = ''
    },
    [onSoundUpload],
  )

  const handleSoundDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingSound(false)
      const file = e.dataTransfer.files?.[0]
      if (file && ALLOWED_SOUND_TYPES.includes(file.type) && onSoundUpload) {
        if (file.size > MAX_SOUND_SIZE) {
          setSoundSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 3MB.`,
          )
          return
        }
        setSoundSizeError(null)
        await onSoundUpload(file)
      }
    },
    [onSoundUpload],
  )

  const handleVideoFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file && onVideoUpload) {
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 50MB.`,
          )
          if (videoInputRef.current) videoInputRef.current.value = ''
          return
        }
        setVideoSizeError(null)
        await onVideoUpload(file)
      }
      if (videoInputRef.current) videoInputRef.current.value = ''
    },
    [onVideoUpload],
  )

  const handleVideoDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDraggingVideo(false)
      const file = e.dataTransfer.files?.[0]
      if (file && ALLOWED_VIDEO_TYPES.includes(file.type) && onVideoUpload) {
        if (file.size > MAX_VIDEO_SIZE) {
          setVideoSizeError(
            `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 50MB.`,
          )
          return
        }
        setVideoSizeError(null)
        await onVideoUpload(file)
      }
    },
    [onVideoUpload],
  )

  return (
    <>
      {/* Page Title — type-specific so the artist immediately sees which
          surface they're on (Image / Text / Video / Sound). */}
      <h1 className={dashboardStyles.pageTitle}>
        {formData.artworkType === 'image'
          ? 'Edit Image'
          : formData.artworkType === 'text'
            ? 'Edit Text'
            : formData.artworkType === 'video'
              ? 'Edit Video'
              : formData.artworkType === 'sound'
                ? 'Edit Sound'
                : 'Edit Artwork'}
      </h1>

      {/* Print Sales — pinned to the top for image artworks so artists see
          the sell-as-print decision before scrolling into metadata.
          The enable toggle gates everything else: provider, price and
          restrictions only render once the artist opts in. */}
      {formData.artworkType === 'image' && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Print Sales</h3>
          <p className={dashboardStyles.sectionDescription}>
            Let buyers order a physical print of this artwork. We&apos;ll show a &quot;Buy
            Printable&quot; button next to &quot;Inquire&quot; on the public page.
          </p>

          <Checkbox
            checked={formData.printEnabled}
            onChange={(e) => {
              if ((printEligible && printableFormat) || !e.target.checked) {
                onFormChange('printEnabled', e.target.checked)
              }
            }}
            label="Enable this artwork for print sales"
            disabled={!printEligible || !printableFormat}
          />
          {!printEligible && (
            <p className={styles.printDisabledHint}>
              Upload an image with at least {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px (around{' '}
              {MIN_DPI} DPI on the largest sellable size) to enable print sales.
            </p>
          )}
          {printEligible && !printableFormat && imageMeta && (
            <p className={styles.printDisabledHint}>
              The current image format ({imageMeta.format}) can&apos;t be printed. Re-upload as JPG,
              PNG or TIFF to enable print sales.
            </p>
          )}

          {formData.printEnabled && (
            <>
              {!prodigiFits && formData.printProvider === 'PRODIGI' && imageMeta && (
                <div className={styles.providerNudge}>
                  <strong>
                    This artwork&apos;s aspect ratio doesn&apos;t match any Prodigi preset.
                  </strong>
                  <p>
                    Prodigi only sells fixed sizes — to keep our &quot;no crop, no pad&quot; promise
                    we hide presets that wouldn&apos;t fit. Switch to <em>The Print Space</em> below
                    and this artwork will be offered at custom sizes that always match its
                    proportions.
                  </p>
                </div>
              )}

              {!formatCompatible && imageMeta && (
                <div className={styles.providerNudge}>
                  <strong>
                    Your current image ({imageMeta.format}) isn&apos;t supported by{' '}
                    {PROVIDER_DISPLAY_NAME[formData.printProvider]}.
                  </strong>
                  <p>
                    {PROVIDER_DISPLAY_NAME[formData.printProvider]} only accepts{' '}
                    {PROVIDER_ACCEPTED_FORMATS[formData.printProvider].join(', ')}. To use this
                    service, remove the image above and upload a new one in a supported format.
                  </p>
                </div>
              )}

              <div
                className={styles.printProviderField}
                role="radiogroup"
                aria-label="Print fulfillment service"
              >
                <span className={styles.printProviderLabel}>Print service</span>
                <div className={styles.printProviderChoices}>
                  {(
                    [
                      {
                        value: 'PRODIGI',
                        label: 'Prodigi',
                        hint: 'Faster delivery, better prices. Standard sizes only, fewer paper & frame options.',
                      },
                      {
                        value: 'PRINTSPACE',
                        label: 'The Print Space',
                        hint: 'Premium quality, hand-made frames, fully custom sizes. Higher prices, longer turnaround.',
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = formData.printProvider === opt.value
                    const compatible = isImageFormatCompatible(imageMeta?.format, opt.value)
                    // Only disable when the option ISN'T currently selected —
                    // a "disabled but selected" radio is an invalid display
                    // state. The warning banner above covers the rare case
                    // where the active selection becomes incompatible.
                    const disabled = !compatible && !selected
                    const optHint = compatible
                      ? opt.hint
                      : `Doesn't support ${imageMeta?.format} — remove this image and upload a ${PROVIDER_ACCEPTED_FORMATS[
                          opt.value
                        ].join(' or ')} to use ${opt.label}.`
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-disabled={disabled}
                        disabled={disabled}
                        className={styles.printProviderChoice}
                        onClick={() => {
                          if (!disabled) onFormChange('printProvider', opt.value)
                        }}
                      >
                        <span
                          className={`${styles.printProviderChoiceCheck} ${
                            selected ? styles.printProviderChoiceCheckSelected : ''
                          }`}
                          aria-hidden="true"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                        <span className={styles.printProviderChoiceBody}>
                          <span className={styles.printProviderChoiceTitle}>{opt.label}</span>
                          <span className={styles.printProviderChoiceHint}>{optHint}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className={styles.printProviderHint}>
                  Switching service resets the advanced restrictions below — each service has its
                  own papers, frames and sizes.
                </p>
              </div>

              <div
                className={dashboardStyles.field}
                style={{ maxWidth: 240, marginTop: 'var(--space-4)' }}
              >
                <label htmlFor="printPriceEuros">Your price per print (&euro;)</label>
                <Input
                  id="printPriceEuros"
                  type="text"
                  inputMode="decimal"
                  size="medium"
                  value={formData.printPriceEuros}
                  onChange={(e) =>
                    onFormChange(
                      'printPriceEuros',
                      // Accept both period and comma as decimal separators
                      // (Spanish/EU users) but normalise to period — the
                      // app's display convention is always `1234.56`.
                      e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''),
                    )
                  }
                  placeholder="100"
                />
              </div>
              <span className={dashboardStyles.hint}>
                This is the amount you earn per print sold. Production, shipping, gallery fee and
                VAT are added separately at checkout.
              </span>
            </>
          )}
        </div>
      )}

      {/* Video File Upload Section - only for video type */}
      {formData.artworkType === 'video' && (
        <div className={`${dashboardStyles.section} ${styles.imageSectionHalf}`}>
          <h3 className={dashboardStyles.sectionTitle}>Video File</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload the video file. This will be played in exhibitions.
          </p>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleVideoFileSelect}
            className={styles.hiddenInput}
          />

          {videoUrl ? (
            <div className={styles.soundPreview}>
              <div className={styles.soundInfo}>
                <Icon name="video" size={24} color="#333" />
                <video
                  controls
                  controlsList="nodownload"
                  src={videoUrl}
                  className={styles.videoPlayer}
                >
                  Your browser does not support the video element.
                </video>
              </div>
              {onVideoRemove && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Remove"
                  onClick={() => onVideoRemove()}
                  type="button"
                />
              )}
            </div>
          ) : (
            <div
              className={`${styles.soundDropzone} ${isDraggingVideo ? styles.dragging : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingVideo(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingVideo(false)
              }}
              onDrop={handleVideoDrop}
              onClick={() => videoInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && videoInputRef.current?.click()}
            >
              {uploading ? (
                <span className={styles.uploadingText}>{loadingText}</span>
              ) : (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    label="Select a Video File"
                    onClick={(e) => {
                      e.stopPropagation()
                      videoInputRef.current?.click()
                    }}
                    type="button"
                  />
                  <span className={styles.dropText}>or drag and drop files</span>
                </>
              )}
            </div>
          )}

          {videoSizeError && <div className={styles.sizeError}>{videoSizeError}</div>}
          <span className={dashboardStyles.hint}>
            Accepted: MP4, WebM (max 50MB). Videos are automatically optimized for the gallery.
          </span>
        </div>
      )}

      {/* Image Upload Section - for image and video types (poster for video) */}
      {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
        <div
          className={`${dashboardStyles.section} ${formData.artworkType === 'image' ? styles.imageSection : styles.imageSectionHalf}`}
        >
          <h3 className={dashboardStyles.sectionTitle}>
            {formData.artworkType === 'video' ? 'Video Poster' : 'Artwork Image'}
          </h3>
          <p className={dashboardStyles.sectionDescription}>
            {formData.artworkType === 'video'
              ? 'Optional. Upload a poster image for this video. If not provided, the first frame of the video will be used.'
              : 'Upload the artwork image. This will be displayed in exhibitions and on your profile.'}
          </p>

          <div className={styles.imageRow}>
            <div className={styles.imageUploaderCol}>
              <ImageUploader
                imageUrl={imageUrl}
                onUpload={onImageUpload}
                onRemove={onImageRemove}
                onMetaChange={handleImageMetaChange}
                displayMeta={serverMeta}
                uploading={uploading}
                loadingText={loadingText}
                aspectRatio="1 / 1"
                objectFit="contain"
                maxSizeBytes={MAX_ARTWORK_UPLOAD_SIZE}
                minWidth={MIN_ARTWORK_IMAGE_WIDTH}
                minHeight={MIN_ARTWORK_IMAGE_HEIGHT}
              />
            </div>

            {/* Print requirements info — only when print sales is enabled.
                The DPI/eligibility detail is irrelevant if the artist
                isn't selling prints, so we keep it gated behind the
                Print Sales toggle to avoid noise. */}
            {formData.artworkType === 'image' && formData.printEnabled && (
              <div className={styles.printInfoCol}>
                <div className={styles.printInfoCard}>
                  <h4 className={styles.printInfoTitle}>
                    <Icon name="printer" size={16} />
                    Sell as print
                  </h4>
                  <p className={styles.printInfoText}>
                    To enable print sales, your image needs to be high resolution (at least{' '}
                    {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px). The larger the image, the more print
                    sizes will be available to buyers.
                  </p>

                  {/* Per-size eligibility — provider-aware:
                      Prodigi has fixed presets; show the eligibility list.
                      TPS supports any custom W×H (aspect-locked); show
                      the maximum size achievable at 200 DPI instead. */}
                  {imageUrl && imageMeta && formData.printProvider === 'PRODIGI' ? (
                    <>
                      <p
                        className={styles.printInfoText}
                        style={{ marginBottom: 'var(--space-1)' }}
                      >
                        <strong>Print size eligibility:</strong>
                      </p>
                      <ul className={styles.printSizeChecklist}>
                        {printSizes.map((s) => (
                          <li
                            key={s.label}
                            className={
                              s.eligible ? styles.printSizeEligible : styles.printSizeIneligible
                            }
                          >
                            <Icon name={s.eligible ? 'check-circle' : 'alert-circle'} size={14} />
                            <span>{s.label}</span>
                            <span className={styles.printSizeDpi}>
                              {Math.min(s.effectiveDpiW, s.effectiveDpiH)} DPI
                            </span>
                          </li>
                        ))}
                      </ul>
                      {eligibleSizes.length === 0 && (
                        <div className={styles.printStatusNotReady}>
                          <Icon name="alert-circle" size={16} />
                          <span>
                            This image is {imageMeta.width} × {imageMeta.height} px — below the
                            minimum for any print size. Upload a higher resolution version to enable
                            print sales.
                          </span>
                        </div>
                      )}
                    </>
                  ) : imageUrl && imageMeta && formData.printProvider === 'PRINTSPACE' ? (
                    (() => {
                      const samples = getTpsSizeSamples(imageMeta)
                      const anyEligible = samples.some((s) => s.eligible)
                      return (
                        <>
                          <p
                            className={styles.printInfoText}
                            style={{ marginBottom: 'var(--space-1)' }}
                          >
                            <strong>Print size eligibility:</strong>
                          </p>
                          <p className={styles.printInfoTextMuted}>
                            The Print Space supports custom sizes — every print respects the
                            original proportions of your file. The values below are reference
                            points, not exact dimensions; buyers can pick any width or height within
                            range, and the other side auto-locks to your artwork&apos;s aspect
                            ratio.
                          </p>
                          <ul className={styles.printSizeChecklist}>
                            {samples.map((s) => (
                              <li
                                key={s.label}
                                className={
                                  s.eligible ? styles.printSizeEligible : styles.printSizeIneligible
                                }
                              >
                                <Icon
                                  name={s.eligible ? 'check-circle' : 'alert-circle'}
                                  size={14}
                                />
                                <span>{s.label}</span>
                                <span className={styles.printSizeDpi}>{s.effectiveDpi} DPI</span>
                              </li>
                            ))}
                          </ul>
                          {!anyEligible && (
                            <div className={styles.printStatusNotReady}>
                              <Icon name="alert-circle" size={16} />
                              <span>
                                This image is {imageMeta.width} × {imageMeta.height} px — below the
                                200 DPI threshold for any sellable size. Upload a higher resolution
                                version to enable print sales.
                              </span>
                            </div>
                          )}
                        </>
                      )
                    })()
                  ) : imageUrl ? (
                    <p className={styles.printInfoTextMuted}>Loading image info...</p>
                  ) : (
                    <p className={styles.printInfoTextMuted}>
                      Upload an image to check print eligibility.
                    </p>
                  )}

                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <Button
                      font="dashboard"
                      variant="primary"
                      label="More info on print sizes"
                      onClick={() => setShowPrintInfoModal(true)}
                      type="button"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className={dashboardStyles.hint}>
            Accepted: JPG, PNG, TIFF. Minimum resolution: {MIN_ARTWORK_IMAGE_WIDTH} ×{' '}
            {MIN_ARTWORK_IMAGE_HEIGHT} px. Images are automatically optimized for the web.
          </span>
        </div>
      )}

      {/* Per-artwork printing restrictions — separate section so the
          parent's hint break-out doesn't visually collide with this block.
          Restrictions are provider-scoped: each service has its own
          papers/frames/sizes vocabulary, so only one set is editable
          at a time. */}
      {formData.artworkType === 'image' && formData.printEnabled && (
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Printing restrictions</h3>
          <p className={dashboardStyles.sectionDescription}>
            Advanced — you don&apos;t need to touch this unless you have very specific reasons not
            to offer a particular paper, format, size or frame for this artwork.
          </p>

          {formData.printProvider === 'PRODIGI' ? (
            <details className={styles.printRestrictions}>
              <summary className={styles.printRestrictionsSummary}>Show options</summary>

              <p className={styles.printRestrictionsIntro}>
                We already offer the best print quality we can — museum-grade papers, archival inks,
                and gallery-tested framing. The options listed below are the ones our printing
                service supports for this kind of artwork. Uncheck anything you&apos;d rather we not
                offer; everything that stays checked remains available to buyers.
              </p>

              <PrintRestrictionGroup
                title="Papers"
                all={PAPERS.map((p) => ({ id: p.id, label: p.label }))}
                dimensionKey="allowedPaperIds"
                options={formData.printOptions as PrintOptions | null}
                onChange={onPrintOptionsChange}
                allIds={PAPERS.map((p) => p.id)}
              />
              <PrintRestrictionGroup
                title="Formats"
                all={FORMATS.map((f) => ({ id: f.id, label: f.label }))}
                dimensionKey="allowedFormatIds"
                options={formData.printOptions as PrintOptions | null}
                onChange={onPrintOptionsChange}
                allIds={FORMATS.map((f) => f.id)}
              />
              <PrintRestrictionGroup
                title="Sizes"
                all={eligibleSizeOptions.map((s) => ({ id: s.id, label: s.label }))}
                dimensionKey="allowedSizeIds"
                options={formData.printOptions as PrintOptions | null}
                onChange={onPrintOptionsChange}
                allIds={eligibleSizeOptions.map((s) => s.id)}
              />
              <PrintRestrictionGroup
                title="Frame colors"
                all={FRAME_COLORS.map((c) => ({ id: c.id, label: c.label }))}
                dimensionKey="allowedFrameColorIds"
                options={formData.printOptions as PrintOptions | null}
                onChange={onPrintOptionsChange}
                allIds={FRAME_COLORS.map((c) => c.id)}
              />
              <PrintRestrictionGroup
                title="Mounts"
                all={MOUNTS.map((m) => ({ id: m.id, label: m.label }))}
                dimensionKey="allowedMountIds"
                options={formData.printOptions as PrintOptions | null}
                onChange={onPrintOptionsChange}
                allIds={MOUNTS.map((m) => m.id)}
              />
            </details>
          ) : (
            <details className={styles.printRestrictions}>
              <summary className={styles.printRestrictionsSummary}>Show options</summary>

              <p className={styles.printRestrictionsIntro}>
                The Print Space offers many options — to keep this simple we only let you veto the
                three that matter most for editorial control: papers, frame types and the
                passepartout. Everything that stays checked remains available to buyers.
              </p>

              <TpsRestrictionGroup
                title="Papers"
                all={TPS_PAPERS.map((p) => ({ id: p.id, label: p.label }))}
                dimensionId="paper"
                restrictions={formData.printOptions as PrintRestrictions | null}
                onChange={onPrintOptionsChange}
                allIds={TPS_PAPERS.map((p) => p.id)}
              />
              <TpsRestrictionGroup
                title="Frame types"
                all={TPS_FRAME_TYPES.map((f) => ({ id: f.id, label: f.label }))}
                dimensionId="frameType"
                restrictions={formData.printOptions as PrintRestrictions | null}
                onChange={onPrintOptionsChange}
                allIds={TPS_FRAME_TYPES.map((f) => f.id)}
              />
              <TpsRestrictionGroup
                title="Mount (Passepartout)"
                all={TPS_WINDOW_MOUNTS.map((w) => ({ id: w.id, label: w.label }))}
                dimensionId="windowMount"
                restrictions={formData.printOptions as PrintRestrictions | null}
                onChange={onPrintOptionsChange}
                allIds={TPS_WINDOW_MOUNTS.map((w) => w.id)}
              />
            </details>
          )}
        </div>
      )}

      {/* Sound Upload Section - only for sound type */}
      {formData.artworkType === 'sound' && (
        <div className={`${dashboardStyles.section} ${styles.imageSectionHalf}`}>
          <h3 className={dashboardStyles.sectionTitle}>Audio File</h3>
          <p className={dashboardStyles.sectionDescription}>
            Upload an audio file. This sound will be playable in exhibitions.
          </p>

          <input
            ref={soundInputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,audio/x-wav,audio/aac,audio/flac"
            onChange={handleSoundFileSelect}
            className={styles.hiddenInput}
          />

          {soundUrl ? (
            <div className={styles.soundPreview}>
              <div className={styles.soundInfo}>
                <Icon name="volume-2" size={24} color="#333" />
                <audio controls src={soundUrl} className={styles.audioPlayer}>
                  Your browser does not support the audio element.
                </audio>
              </div>
              {onSoundRemove && (
                <Button
                  font="dashboard"
                  variant="secondary"
                  label="Remove"
                  onClick={() => onSoundRemove()}
                  type="button"
                />
              )}
            </div>
          ) : (
            <div
              className={`${styles.soundDropzone} ${isDraggingSound ? styles.dragging : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingSound(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDraggingSound(false)
              }}
              onDrop={handleSoundDrop}
              onClick={() => soundInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && soundInputRef.current?.click()}
            >
              {uploading ? (
                <span className={styles.uploadingText}>{loadingText}</span>
              ) : (
                <>
                  <Button
                    font="dashboard"
                    variant="primary"
                    label="Select an Audio File"
                    onClick={(e) => {
                      e.stopPropagation()
                      soundInputRef.current?.click()
                    }}
                    type="button"
                  />
                  <span className={styles.dropText}>or drag and drop files</span>
                </>
              )}
            </div>
          )}

          {soundSizeError && <div className={styles.sizeError}>{soundSizeError}</div>}
          <span className={dashboardStyles.hint}>
            Accepted: MP3, M4A, OGG, WebM, WAV, AAC, FLAC (max 3MB).
          </span>
        </div>
      )}

      <form onSubmit={onSubmit}>
        {/* Title Section */}
        <div className={dashboardStyles.section}>
          <h3 className={dashboardStyles.sectionTitle}>Title</h3>
          <p className={dashboardStyles.sectionDescription}>The display title for your artwork.</p>
          <Input
            id="title"
            type="text"
            size="medium"
            value={formData.title}
            onChange={(e) => onFormChange('title', e.target.value)}
            required
          />
          <span className={dashboardStyles.hint}>
            This will be shown in exhibitions and on your profile.
          </span>
        </div>

        {/* Author */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Author</h3>
            <Input
              id="author"
              type="text"
              size="medium"
              value={formData.author}
              onChange={(e) => onFormChange('author', e.target.value)}
            />
          </div>
        )}

        {/* Year */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Year</h3>
            <Input
              id="year"
              type="text"
              size="medium"
              value={formData.year}
              onChange={(e) => onFormChange('year', e.target.value)}
            />
          </div>
        )}

        {/* Technique / Medium */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Technique / Medium</h3>
            <RichTextEditor
              content={formData.technique}
              onChange={(content) => onFormChange('technique', content)}
              placeholder="e.g. Oil on canvas, mixed media..."
            />
          </div>
        )}

        {/* Dimensions */}
        {formData.artworkType === 'image' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Dimensions</h3>
            <p className={dashboardStyles.sectionDescription}>
              A reference dimension shown on the public artwork page — most relevant for unique
              physical works (paintings, drawings, sculptures) where the size is fixed. For
              photography or editions sold as prints, list the original capture size; the actual
              print sizes are picked by the buyer in the print wizard.
            </p>
            <Input
              id="dimensions"
              type="text"
              size="medium"
              value={formData.dimensions}
              onChange={(e) => onFormChange('dimensions', e.target.value)}
              placeholder="e.g. 40 × 30 cm"
            />
            <span className={dashboardStyles.hint}>
              Follow gallery convention: height × width (× depth for 3D works).
            </span>
          </div>
        )}

        {/* Text Content - for text artworks (plain text only for 3D) */}
        {formData.artworkType === 'text' && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Text Content</h3>
            <p className={dashboardStyles.sectionDescription}>
              Plain text content that will be displayed on the 3D stencil.
            </p>
            <textarea
              value={formData.textContent}
              onChange={(e) => onFormChange('textContent', e.target.value)}
              placeholder="Enter the text to display..."
              rows={8}
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                lineHeight: '1.6',
                resize: 'vertical',
              }}
            />
            <span className={dashboardStyles.hint}>
              Text styling (font, weight, size) is limited in 3D and can be adjusted in the wall
              panel.
            </span>
          </div>
        )}

        {/* Description - for image artworks (supports rich text) */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Description</h3>
            <RichTextEditor
              content={formData.description}
              onChange={(content) => onFormChange('description', content)}
              placeholder="About this artwork..."
            />
          </div>
        )}

        {/* Featured Checkbox */}
        {(formData.artworkType === 'image' || formData.artworkType === 'video') && (
          <div className={dashboardStyles.section}>
            <h3 className={dashboardStyles.sectionTitle}>Featured Artwork</h3>
            <p className={dashboardStyles.sectionDescription}>
              Highlight this artwork on your public artist profile.
            </p>
            <Checkbox
              checked={formData.featured}
              onChange={(e) => onFormChange('featured', e.target.checked)}
              label="Feature on artist profile"
            />
            <span className={dashboardStyles.hint}>
              Featured artworks appear prominently in your profile&apos;s artwork grid.
            </span>
          </div>
        )}

        <ErrorText>{error}</ErrorText>

        <div className={dashboardStyles.actions}>
          <Button
            font="dashboard"
            variant="primary"
            label={saving ? 'Saving...' : 'Save'}
            type="submit"
          />
          <Button
            font="dashboard"
            variant="secondary"
            label="Cancel"
            onClick={onCancel}
            type="button"
          />
        </div>
      </form>

      {/* Print sizes info modal */}
      {showPrintInfoModal && (
        <Modal onClose={() => setShowPrintInfoModal(false)}>
          <div className={styles.printModal}>
            <Text as="h3" font="dashboard" size="lg" weight="medium">
              Print Size Requirements
            </Text>
            <p className={styles.printModalDescription}>
              Each print size requires a minimum image resolution at {MIN_DPI} DPI. The table below
              shows the minimum pixel dimensions needed for each size we offer.
            </p>
            <table className={styles.printModalTable}>
              <thead>
                <tr>
                  <th>Print Size</th>
                  <th>Min. Resolution</th>
                  {imageMeta && <th>Your DPI</th>}
                  {imageMeta && <th>Status</th>}
                </tr>
              </thead>
              <tbody>
                {printSizes.map((size) => (
                  <tr key={size.label}>
                    <td>{size.label}</td>
                    <td>
                      {size.requiredWidth} × {size.requiredHeight} px
                    </td>
                    {imageMeta && (
                      <td>
                        <span
                          className={size.eligible ? styles.statusReady : styles.statusNotReady}
                        >
                          {Math.min(size.effectiveDpiW, size.effectiveDpiH)} DPI
                        </span>
                      </td>
                    )}
                    {imageMeta && (
                      <td>
                        {size.eligible ? (
                          <span className={styles.statusReady}>
                            <Icon name="check-circle" size={14} /> Ready
                          </span>
                        ) : (
                          <span className={styles.statusNotReady}>
                            <Icon name="alert-circle" size={14} /> Too small
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {imageMeta && (
              <p className={styles.printModalCurrentRes}>
                Your image: {imageMeta.width} × {imageMeta.height} px
              </p>
            )}
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}
            >
              <Button
                font="dashboard"
                variant="primary"
                label="Got it"
                onClick={() => setShowPrintInfoModal(false)}
                type="button"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
