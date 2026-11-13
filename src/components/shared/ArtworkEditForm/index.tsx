'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { CaretDown, LockSimple, Printer, SpeakerHigh, VideoCamera } from '@phosphor-icons/react'
import c from 'classnames'

import { AdminCheckbox } from '@/components/admin/ui/AdminCheckbox'
import { Callout } from '@/components/admin/ui/Callout'
import { StatusPill } from '@/components/admin/ui/StatusPill'
import { Button } from '@/components/ui/Button'
import { ErrorText } from '@/components/ui/ErrorText'
import { FileInput } from '@/components/ui/FileInput'
import { ImageUploader } from '@/components/ui/ImageUploader'
import type { ImageMeta } from '@/components/ui/ImageUploader'
import { Input } from '@/components/ui/Input'
import Modal from '@/components/ui/Modal/Modal'
import { RadioGroup } from '@/components/ui/RadioGroup'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { SelectDropdown } from '@/components/ui/SelectDropdown'
import { Toggle } from '@/components/ui/Toggle'
import {
  MIN_DPI,
  TPS_FRAME_TYPES,
  TPS_PAPERS,
  TPS_WINDOW_MOUNTS,
  formatPrintSize,
  getPrintLongEdgeBounds,
  getPrintMaxSize,
  getPrintMinSize,
} from '@/lib/print-providers/printspace'
import type { PrintRecommendations, PrintRestrictions } from '@/lib/print-providers'
import type { LimitedVariantDraft } from '@/lib/editions/types'
import { resolveArtworkAuthor } from '@/utils/artistDisplayName'
import { LimitedVariantsEditor } from './LimitedVariantsEditor'
import { ArtworkMediaManager } from './ArtworkMediaManager'
import { EditorPanel } from './EditorPanel'
import { LockNote } from './LockNote'
import { OptionChips } from './OptionChips'
import { SectionNav } from './SectionNav'
import {
  ARTWORK_EDIT_FORM_ID,
  ARTWORK_SECTION,
  panelDescriptionId,
  panelTitleId,
  type ArtworkSection,
} from './sections'
import {
  MAX_ARTWORK_UPLOAD_SIZE,
  MIN_ARTWORK_IMAGE_WIDTH,
  MIN_ARTWORK_IMAGE_HEIGHT,
  MIN_PRINT_WIDTH,
  MIN_PRINT_HEIGHT,
} from '@/lib/imageConfig'

import { scrollToFirstError } from '@/lib/validation/scrollToFirstError'
import styles from './ArtworkEditForm.module.scss'

export { ARTWORK_EDIT_FORM_ID } from './sections'

/** The print sizes dialog's title (one dialog per page). */
const PRINT_SIZES_TITLE_ID = 'artwork-print-sizes-title'

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
  /**
   * The artwork's own artist, used to prefill the Author field. Optional
   * because `ArtworkEditModal` populates from a payload that does not carry it;
   * `resolveArtworkAuthor` treats a missing artist as "no name to offer".
   */
  user?: { name?: string | null; lastName?: string | null } | null
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
  editionType?: 'open' | 'limited'
  editionLocked?: boolean
  limitedVariants?: LimitedVariantDraft[]
  printEditionLimited?: boolean
  printEditionTotal?: number | null
  /**
   * Artist-set veto/allow-list for printing options. Canonical
   * `PrintRestrictions` shape: `{ allowed: { dimensionId: ids[] } }`.
   * Stored as JSON; the page route + payment-intent re-check both
   * read it.
   */
  printOptions?: PrintRestrictions | null
  /**
   * Artist-set "recommended" paper IDs. Soft hint — surfaces a
   * check-circle in the buyer's paper picker but does NOT filter
   * availability. Stored as JSON. Canonical shape: `{ paper: string[] }`.
   */
  printRecommendations?: PrintRecommendations | null
  /**
   * Exhibitions currently showing this artwork on their page (`showOnPage`
   * rows only). Populated by the privileged artwork GET so the dashboard's
   * Exhibitions picker can pre-check the artist's real curation instead of
   * always rendering blank. Optional because `ArtworkEditModal` populates
   * from the same payload and has no picker to feed.
   */
  exhibitionIds?: string[]
  /** The section each member exhibition places this work in (null = none).
   *  Keyed by exhibition id; same source as `exhibitionIds`. */
  exhibitionSections?: Record<string, string | null>
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
  /** 'open' = fully configurable prints (current flow). 'limited' = numbered
   *  edition sold via pre-defined variants only. */
  editionType: 'open' | 'limited'
  /** True once the artist has clicked "Ready to Sell" — the edition config
   *  is frozen and only an admin can unblock it. */
  editionLocked: boolean
  /** Limited-edition variants (1 mandatory + up to 3 optional). Only used
   *  when `editionType === 'limited'`. */
  limitedVariants: LimitedVariantDraft[]
  /** @deprecated legacy flag, superseded by `editionType`. */
  printEditionLimited: boolean
  /** @deprecated legacy field, superseded by `limitedVariants`. */
  printEditionTotal: string
  /**
   * Artist-set restrictions in canonical PrintRestrictions shape.
   * `null` = no restrictions (all options offered).
   */
  printOptions: PrintRestrictions | null
  /**
   * Artist-set paper recommendations. `null` = nothing recommended,
   * wizard shows no checkmarks. Today only `paper` is meaningful.
   */
  printRecommendations: PrintRecommendations | null
  /** Ids of the exhibitions this artwork should appear in. Independent of
   *  placement — see the Exhibitions section below. */
  exhibitionIds: string[]
  /** Section per exhibition, keyed by exhibition id. Only ticked exhibitions'
   *  entries are applied on save. */
  exhibitionSections: Record<string, string | null>
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
  editionType: 'open',
  editionLocked: false,
  limitedVariants: [],
  printEditionLimited: false,
  printEditionTotal: '',
  printOptions: null,
  printRecommendations: null,
  exhibitionIds: [],
  exhibitionSections: {},
})

export const populateFormData = (data: Artwork): ArtworkFormData => ({
  name: data.name || '',
  artworkType: data.artworkType || 'image',
  title: data.title || '',
  // Prefilled with the artwork's artist when empty — see `resolveArtworkAuthor`.
  author: resolveArtworkAuthor(data.author, data.user),
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
  editionType: data.editionType === 'limited' ? 'limited' : 'open',
  editionLocked: data.editionLocked ?? false,
  limitedVariants: (data.limitedVariants ?? []).map((v) => ({
    ...v,
    priceEuros: typeof v.priceCents === 'number' ? (v.priceCents / 100).toString() : '',
  })),
  printEditionLimited: data.printEditionLimited ?? false,
  printEditionTotal:
    typeof data.printEditionTotal === 'number' ? String(data.printEditionTotal) : '',
  printOptions: data.printOptions ?? null,
  printRecommendations: data.printRecommendations ?? null,
  exhibitionIds: data.exhibitionIds ?? [],
  exhibitionSections: data.exhibitionSections ?? {},
})

/** Every value shape the form's single change handler carries. */
export type ArtworkFormValue = string | boolean | string[] | Record<string, string | null>

type ArtworkEditFormProps = {
  formData: ArtworkFormData
  /** Saved artwork id — enables variant templates ("Apply saved variant");
   *  absent on the create-new form. */
  artworkId?: string | null
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
  onFormChange: (field: string, value: ArtworkFormValue) => void
  /** The artist's own exhibitions, for the Exhibitions checkbox section. Renders
   *  only when this is supplied — the wall-view ArtworkEditModal is already
   *  inside one exhibition and has no use for a cross-exhibition picker. Each
   *  carries its sections, in page order, for the per-exhibition dropdown. */
  exhibitions?: {
    id: string
    mainTitle: string
    published: boolean
    sections: { id: string; title: string }[]
  }[]
  /** Replace the whole printOptions object. Called as the artist (un)checks boxes. */
  onPrintOptionsChange?: (next: PrintRestrictions | null) => void
  /** Replace the whole printRecommendations object. Paper IDs only for now. */
  onPrintRecommendationsChange?: (next: PrintRecommendations | null) => void
  /** Switch between open and limited editions. */
  onEditionTypeChange?: (next: 'open' | 'limited') => void
  /** Replace the whole limited-variants array (dashboard editor). */
  onVariantsChange?: (next: LimitedVariantDraft[]) => void
  /** True when the current viewer is an admin / superAdmin — they can
   *  unblock individual limited variants; artists cannot. */
  isAdmin?: boolean
  /** True only for superAdmin — gates the open-edition "Unblock" control,
   *  which reopens a locked open artwork's print setup. */
  isSuperAdmin?: boolean
  /** "Ready to Sell" — lock the edition config (and publish variants). */
  onReadyToSell?: () => void
  /** Admin-only: unblock a locked artwork so its config is editable. */
  onUnblock?: () => void
  /** Admin-only: take a live limited variant off sale to edit it. */
  onUnblockVariant?: (variantId: string) => void
  /** Put an off-sale limited variant on sale ("Ready to Sell"). */
  onReadyToSellVariant?: (index: number) => void
  /** Delete a saved limited variant on the server, at once (confirmed in the
   *  editor). Unsaved rows never reach this. */
  onDeleteVariant?: (variantId: string) => Promise<{ ok: boolean; error?: string }>
  /** Save (or create) one variant on its own, without an artwork save. */
  onSaveVariant?: (
    variantId: string | null,
    values: LimitedVariantDraft,
  ) => Promise<{ ok: boolean; error?: string; variantId?: string }>
  onImageUpload: (file: File, previewUrl?: string) => Promise<void>
  onImageRemove: () => void | Promise<void>
  onSoundUpload?: (file: File) => Promise<void>
  onSoundRemove?: () => void | Promise<void>
  onVideoUpload?: (file: File) => Promise<void>
  onVideoRemove?: () => void | Promise<void>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  /**
   * page: the studio's artwork editor (artist.md §3): no h1 (the page has the
   * header), the On this page list, and no Save / Cancel row (the page's save
   * bar submits this form by ARTWORK_EDIT_FORM_ID). overlay (default): the wall
   * view's View details overlay, with its own h1 and a Cancel / Save changes row.
   */
  variant?: 'page' | 'overlay'
  /** Display only: each rich-text editor's own HTML for the text it loaded with
   *  (RichTextEditor `onReady`), for the page's "Unsaved changes". */
  onRichTextReady?: (field: 'technique' | 'description', html: string) => void
  /** Display only: the variants editor's unsaved count, for the page's save bar. */
  onVariantsDirtyChange?: (count: number) => void
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

// TPS accepted image formats. Used to gate the print-sales toggle for
// legacy uploads (e.g. WebP) where the file can't be sent to TPS.
const TPS_ACCEPTED_FORMATS: readonly string[] = ['JPEG', 'PNG', 'TIFF']

function isImageFormatPrintable(format: string | undefined | null): boolean {
  if (!format) return true
  const upper = format.toUpperCase()
  // Skip the placeholder fallback used when we don't have a real
  // format on hand (e.g. legacy artworks pre-format-tracking).
  if (upper === 'IMAGE') return true
  return TPS_ACCEPTED_FORMATS.includes(upper)
}

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
  // Pressed = offered to buyers (today's checked box); all pressed by default.
  return (
    <OptionChips
      title={title}
      options={all.map((item) => ({
        id: item.id,
        label: item.label,
        pressed: isTpsDimensionChecked(restrictions, dimensionId, item.id),
      }))}
      onToggle={handleToggle}
    />
  )
}

// Paper recommendation toggles. Same opt-in model as restrictions, but
// the default state is "not recommended" — no implicit all-recommended
// universe. Storing `null` when the artist clears every paper keeps the
// wizard's empty-state logic ("no checkmarks, no legend") simple.
function togglePaperRecommendation(
  current: PrintRecommendations | null,
  paperId: string,
): PrintRecommendations | null {
  const list = current?.paper ?? []
  const idx = list.indexOf(paperId)
  const next = idx === -1 ? [...list, paperId] : list.filter((x) => x !== paperId)
  if (next.length === 0) return null
  return { paper: next }
}

function isPaperRecommended(
  recommendations: PrintRecommendations | null,
  paperId: string,
): boolean {
  return recommendations?.paper?.includes(paperId) ?? false
}

type PaperRecommendationGroupProps = {
  papers: Array<{ id: string; label: string }>
  recommendations: PrintRecommendations | null
  onChange?: (next: PrintRecommendations | null) => void
}

const PaperRecommendationGroup = ({
  papers,
  recommendations,
  onChange,
}: PaperRecommendationGroupProps) => {
  const handleToggle = (id: string) => {
    if (!onChange) return
    onChange(togglePaperRecommendation(recommendations, id))
  }
  if (papers.length === 0) {
    return (
      <p className={styles.printRestrictionsIntro}>
        You&apos;ve vetoed every paper in your printing restrictions — nothing to recommend.
      </p>
    )
  }
  // Pressed = recommended (today's checked box).
  return (
    <OptionChips
      title="Papers"
      options={papers.map((item) => ({
        id: item.id,
        label: item.label,
        pressed: isPaperRecommended(recommendations, item.id),
      }))}
      onToggle={handleToggle}
    />
  )
}

export const ArtworkEditForm = ({
  formData,
  artworkId = null,
  imageUrl,
  imageDpi,
  originalWidth,
  originalHeight,
  originalFormat,
  originalSizeBytes,
  soundUrl,
  videoUrl,
  exhibitions,
  uploading,
  loadingText = 'Uploading...',
  saving,
  error,
  onFormChange,
  onPrintOptionsChange,
  onPrintRecommendationsChange,
  onEditionTypeChange,
  onVariantsChange,
  isAdmin = false,
  isSuperAdmin = false,
  onReadyToSell,
  onUnblock,
  onUnblockVariant,
  onReadyToSellVariant,
  onDeleteVariant,
  onSaveVariant,
  onImageUpload,
  onImageRemove,
  onSoundUpload,
  onSoundRemove,
  onVideoUpload,
  onVideoRemove,
  onSubmit,
  onCancel,
  variant = 'overlay',
  onRichTextReady,
  onVariantsDirtyChange,
}: ArtworkEditFormProps) => {
  const soundInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingSound, setIsDraggingSound] = useState(false)
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [soundSizeError, setSoundSizeError] = useState<string | null>(null)
  const [videoSizeError, setVideoSizeError] = useState<string | null>(null)
  // Silent until the artist clicks the open-edition "Ready to Sell"; then the
  // price error shows and clears live once a valid price is entered.
  const [triedOpenReadyToSell, setTriedOpenReadyToSell] = useState(false)
  // Title is required (the form has noValidate, so we guard it in JS rather than
  // via the native bubble; the server only sanitizes, it doesn't reject empty).
  const [titleError, setTitleError] = useState<string>()

  const handleFormSubmit = (e: React.FormEvent) => {
    if (!formData.title.trim()) {
      e.preventDefault()
      setTitleError('Please enter a title.')
      scrollToFirstError()
      return
    }
    setTitleError(undefined)
    onSubmit(e)
  }
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

  // A freshly picked file reports a real byte size; the CDN-image probe
  // reports 0. So when the artist has just chosen a replacement (before
  // saving), prefer that file's metadata — otherwise the "Original file"
  // line and the print check keep showing the stale saved-original until save.
  const pendingClientMeta = clientMeta && clientMeta.sizeBytes > 0 ? clientMeta : null

  // Priority: a pending pick > the saved original (server) > CDN-probed meta.
  const imageMeta = pendingClientMeta ?? serverMeta ?? clientMeta

  // Aspect ratio (width / height) + long-edge bounds for the limited-edition
  // variant size inputs — same source the buyer wizard uses, so variant
  // sizing behaves identically.
  const editionAspectRatio =
    imageMeta && imageMeta.width > 0 && imageMeta.height > 0
      ? imageMeta.width / imageMeta.height
      : 1
  const editionLongEdgeBounds = getPrintLongEdgeBounds(imageMeta)

  // TPS supports custom sizes (aspect-locked), so eligibility is
  // sample-based: walk a series of long-edge values, find any that
  // hit 300 DPI. If at least one passes, the artist can sell prints.
  const printMinSize = getPrintMinSize(imageMeta)
  const printEligible = printMinSize !== null
  const printMaxSize = printEligible ? getPrintMaxSize(imageMeta) : null

  // Format check: TPS accepts JPG/PNG/TIFF. Disables the
  // "Enable print sales" toggle for legacy uploads (e.g. WebP).
  const printableFormat = isImageFormatPrintable(imageMeta?.format)

  // Series-type lock. Open editions use the stored artwork-level flag (set by
  // the artwork "Ready to Sell", reversed by admin unblock). Limited editions
  // derive it: the open/limited radio freezes as soon as ANY variant is live
  // (published + blocked) and re-opens once every variant is unblocked.
  const hasLiveVariant = formData.limitedVariants.some(
    (v) => v.published === true && v.blocked !== false,
  )
  const seriesTypeLocked =
    formData.editionType === 'limited' ? hasLiveVariant : formData.editionLocked

  // Open-edition price is required to go live. Silent until the artist tries to
  // "Ready to Sell", then shows + clears live as they enter a valid price.
  const openPriceInvalid = !formData.printPriceEuros || !(Number(formData.printPriceEuros) > 0)
  const openPriceError = triedOpenReadyToSell && openPriceInvalid
  const handleOpenReadyToSell = () => {
    if (openPriceInvalid) {
      setTriedOpenReadyToSell(true)
      scrollToFirstError()
      return
    }
    onReadyToSell?.()
  }

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

  // Which sections render: today's conditions, named once so the panels and the
  // studio page's On this page list can never disagree.
  const isImage = formData.artworkType === 'image'
  const isVideo = formData.artworkType === 'video'
  const isImageOrVideo = isImage || isVideo
  const showOpenPrintOptions = isImage && formData.printEnabled && formData.editionType === 'open'
  const showExhibitions = !!exhibitions && exhibitions.length > 0 && isImage
  const showSupplementary = isAdmin && !!artworkId
  const isPage = variant === 'page'
  const imageSection = isVideo ? ARTWORK_SECTION.poster : ARTWORK_SECTION.image

  const rendered: (ArtworkSection | false)[] = [
    isImage && ARTWORK_SECTION.printSales,
    isVideo && ARTWORK_SECTION.videoFile,
    isImageOrVideo && imageSection,
    showOpenPrintOptions && ARTWORK_SECTION.ready,
    formData.artworkType === 'sound' && ARTWORK_SECTION.audioFile,
    ARTWORK_SECTION.details,
    formData.artworkType === 'text' && ARTWORK_SECTION.text,
    isImageOrVideo && ARTWORK_SECTION.description,
    isImageOrVideo && ARTWORK_SECTION.where,
    showSupplementary && ARTWORK_SECTION.media,
  ]
  const sections = rendered.filter((section): section is ArtworkSection => Boolean(section))

  return (
    <>
      <div className={isPage ? styles.pageLayout : styles.overlayLayout}>
        {isPage ? (
          <SectionNav sections={sections} />
        ) : (
          // The wall view's overlay has no page header: the type-specific title
          // stays, so the artist sees which surface they're on.
          <h1 className={styles.overlayTitle}>
            {formData.artworkType === 'image'
              ? 'Edit image'
              : formData.artworkType === 'text'
                ? 'Edit text'
                : formData.artworkType === 'video'
                  ? 'Edit video'
                  : formData.artworkType === 'sound'
                    ? 'Edit sound'
                    : 'Edit artwork'}
          </h1>
        )}

        <div className={styles.column}>
          {/* Print Sales — pinned to the top for image artworks so artists see
              the sell-as-print decision before scrolling into metadata.
              The enable toggle gates everything else: provider, price and
              restrictions only render once the artist opts in. */}
          {isImage && (
            <EditorPanel
              section={ARTWORK_SECTION.printSales}
              description="Enable this artwork for print sales"
              aside={
                <Toggle
                  tone="admin"
                  id="print-enabled"
                  aria-labelledby={panelDescriptionId(ARTWORK_SECTION.printSales)}
                  aria-describedby="print-sales-description"
                  checked={formData.printEnabled}
                  onChange={(e) => {
                    if ((printEligible && printableFormat) || !e.target.checked) {
                      onFormChange('printEnabled', e.target.checked)
                    }
                  }}
                  disabled={!printEligible || !printableFormat}
                />
              }
            >
              <p id="print-sales-description" className={styles.help}>
                Let buyers order a physical print of this artwork. We&apos;ll show a &quot;Buy
                Printable&quot; button next to &quot;Inquire&quot; on the public page.
              </p>
              {!printEligible && !imageMeta && (
                <p className={styles.help}>
                  Upload your artwork image to check print eligibility. Prints need at least{' '}
                  {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px (about {MIN_DPI} DPI on the smallest
                  sellable print).
                </p>
              )}
              {!printEligible && imageMeta && (
                <Callout
                  tone="amber"
                  title="This image isn't high enough resolution for print sales."
                >
                  <span className={styles.calloutLines}>
                    <span>
                      Your file:{' '}
                      <strong>
                        {imageMeta.width} × {imageMeta.height} px
                      </strong>
                    </span>
                    <span>
                      Required:{' '}
                      <strong>
                        at least {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px
                      </strong>
                    </span>
                    <span>
                      Re-upload a higher-resolution version to enable prints. We need {MIN_DPI} DPI
                      on the smallest sellable print (20 cm on the long edge).
                    </span>
                  </span>
                </Callout>
              )}
              {printEligible && !printableFormat && imageMeta && (
                <p className={styles.help}>
                  The current image format ({imageMeta.format}) can&apos;t be printed. Re-upload as
                  JPEG, PNG or TIFF to enable print sales.
                </p>
              )}

              {formData.printEnabled && (
                <>
                  {/* Artwork-level banner — reports ONLY the series-type lock,
                      which is the one thing that really is artwork-wide (the
                      open/limited radio below is disabled by it). Variant freezing
                      is per-variant and each live variant says so on its own card;
                      stating it here made fully-editable sibling variants look
                      frozen. The reason differs by type: an open edition locks when
                      the artwork itself is marked ready to sell, a limited one as
                      soon as ANY variant goes on sale. */}
                  {seriesTypeLocked && (
                    <LockNote>
                      <strong>The series type is locked.</strong>{' '}
                      {formData.editionType === 'limited'
                        ? 'At least one variant is ready to sell, so this artwork can no longer be switched to an open edition.'
                        : 'This artwork is marked ready to sell, so it can no longer be switched to a limited edition.'}
                    </LockNote>
                  )}

                  <div className={styles.printGrid}>
                    <div className={styles.field}>
                      {/* Locked: a read-only field (artist.md §3); otherwise today's radios. */}
                      {seriesTypeLocked ? (
                        <>
                          <span className={styles.label}>Series type</span>
                          <div className={styles.readOnly}>
                            {formData.editionType === 'limited'
                              ? 'Limited edition'
                              : 'Open edition'}
                            <StatusPill tone="gray" shape="tag" icon={LockSimple} label="Locked" />
                          </div>
                        </>
                      ) : (
                        <fieldset className={styles.fieldset}>
                          <legend className={styles.label}>Series type</legend>
                          <RadioGroup<'open' | 'limited'>
                            name="editionType"
                            options={[
                              { value: 'open', label: 'Open edition' },
                              { value: 'limited', label: 'Limited edition' },
                            ]}
                            value={formData.editionType}
                            disabled={seriesTypeLocked}
                            onChange={(v) => onEditionTypeChange?.(v)}
                          />
                        </fieldset>
                      )}
                      <p className={styles.help}>
                        {formData.editionType === 'limited'
                          ? 'Numbered, print-only editions sold in pre-defined variants. Buyers pick a variant — no framing.'
                          : 'Fully configurable prints — buyers choose size, paper and framing. Unlimited.'}
                      </p>
                    </div>

                    {/* Open editions: one artist price for the whole artwork. Limited
                        editions are priced per variant (in the editor below). */}
                    {formData.editionType === 'open' && (
                      <div className={styles.field}>
                        <label htmlFor="printPriceEuros" className={styles.label}>
                          Your price per print (&euro;)
                        </label>
                        <div className={styles.money}>
                          <span aria-hidden className={styles.currency}>
                            €
                          </span>
                          <Input
                            id="printPriceEuros"
                            type="text"
                            inputMode="decimal"
                            size="bare"
                            className={styles.moneyField}
                            inputClassName={styles.moneyInput}
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
                            placeholder="Add your price here"
                            invalid={openPriceError}
                            aria-describedby="print-price-help"
                          />
                        </div>
                        {openPriceError && (
                          <ErrorText>Price is required and must be greater than 0.</ErrorText>
                        )}
                        <p id="print-price-help" className={styles.help}>
                          This is the amount you earn per print sold. Production, shipping, gallery
                          fee and VAT are added separately at checkout.
                        </p>
                      </div>
                    )}
                  </div>

                  {formData.editionType === 'limited' && (
                    <div className={styles.variants}>
                      <h3 className={styles.label}>Edition variants</h3>
                      <p className={styles.help}>
                        Define 1–4 variants. Each is its own numbered edition (e.g. “Small” 1/50)
                        with its own size and price. Sizes must be distinct. Once you start selling,
                        the edition is locked — only the price can still be changed (raise it as
                        copies sell).
                      </p>
                      <LimitedVariantsEditor
                        variants={formData.limitedVariants}
                        aspectRatio={editionAspectRatio}
                        longEdgeBounds={editionLongEdgeBounds}
                        onChange={(next) => onVariantsChange?.(next)}
                        artworkId={artworkId}
                        isAdmin={isAdmin}
                        onUnblockVariant={onUnblockVariant}
                        onReadyToSellVariant={onReadyToSellVariant}
                        onDeleteVariant={onDeleteVariant}
                        onSaveVariant={onSaveVariant}
                        onDirtyCountChange={onVariantsDirtyChange}
                      />
                    </div>
                  )}

                  {/* Limited editions publish per variant (the button lives inside
                      each variant card above). Open editions show their
                      "Ready to sell" / "Unblock" control below the printing
                      options instead — see the open-edition go-live section. */}
                </>
              )}
            </EditorPanel>
          )}

          {/* Video file - only for video type */}
          {isVideo && (
            <EditorPanel
              section={ARTWORK_SECTION.videoFile}
              description="Upload the video file. This will be played in exhibitions."
            >
              <FileInput
                ref={videoInputRef}
                id="artwork-video-file"
                accept="video/mp4,video/webm"
                onChange={handleVideoFileSelect}
                className={styles.hiddenInput}
              />

              {videoUrl ? (
                <div className={styles.filePreview}>
                  <div className={styles.fileInfo}>
                    <VideoCamera size={24} weight="light" aria-hidden className={styles.fileIcon} />
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
                      variant="bare"
                      font="dashboard"
                      className={styles.removeFile}
                      onClick={() => onVideoRemove()}
                      type="button"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className={c(styles.dropzone, isDraggingVideo && styles.dragging)}
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
                        variant="bare"
                        font="dashboard"
                        className={styles.selectFile}
                        onClick={(e) => {
                          e.stopPropagation()
                          videoInputRef.current?.click()
                        }}
                        type="button"
                      >
                        Select a video file
                      </Button>
                      <span className={styles.dropText}>or drag and drop files</span>
                    </>
                  )}
                </div>
              )}

              {videoSizeError && <div className={styles.sizeError}>{videoSizeError}</div>}
              <p className={styles.help}>
                Accepted: MP4, WebM (max 50MB). Videos are automatically optimized for the gallery.
              </p>
            </EditorPanel>
          )}

          {/* Image - for image and video types (poster for video) */}
          {isImageOrVideo && (
            <EditorPanel
              section={imageSection}
              description={
                isVideo
                  ? 'Optional. Upload a poster image for this video. If not provided, the first frame of the video will be used.'
                  : 'Upload the artwork image. This will be displayed in exhibitions and on your profile.'
              }
            >
              <ImageUploader
                tone="admin"
                align="start"
                imageUrl={imageUrl}
                onUpload={onImageUpload}
                onRemove={onImageRemove}
                onMetaChange={handleImageMetaChange}
                displayMeta={pendingClientMeta ?? serverMeta}
                uploading={uploading}
                loadingText={loadingText}
                aspectRatio="1 / 1"
                objectFit="contain"
                maxSizeBytes={MAX_ARTWORK_UPLOAD_SIZE}
                minWidth={MIN_ARTWORK_IMAGE_WIDTH}
                minHeight={MIN_ARTWORK_IMAGE_HEIGHT}
                note={
                  <>
                    <span>
                      Accepted: JPEG, PNG, TIFF. Minimum resolution: {MIN_ARTWORK_IMAGE_WIDTH} ×{' '}
                      {MIN_ARTWORK_IMAGE_HEIGHT} px. Images are automatically optimized for the web.
                    </span>
                    {/* Print requirements info — only when print sales is enabled.
                        The DPI/eligibility detail is irrelevant if the artist
                        isn't selling prints, so we keep it gated behind the
                        Print Sales toggle to avoid noise. */}
                    {isImage && formData.printEnabled && (
                      <div className={styles.printBox}>
                        <h3 className={styles.printBoxTitle}>
                          <Printer size={16} weight="light" aria-hidden />
                          Sell as print
                        </h3>
                        <p>
                          To enable print sales, your image needs to be high resolution (at least{' '}
                          {MIN_PRINT_WIDTH} × {MIN_PRINT_HEIGHT} px). The larger the image, the more
                          print sizes will be available to buyers.
                        </p>

                        {imageUrl && imageMeta ? (
                          printMinSize ? (
                            <>
                              <p>
                                <strong>Print size range for this file:</strong>
                              </p>
                              <p className={styles.printBoxMuted}>
                                This range is the maximum we can print sharply for{' '}
                                <strong>this specific artwork</strong> — the higher the resolution
                                of the file you uploaded, the bigger the max. Buyers pick any custom
                                size in this range; the other side auto-locks to your artwork&apos;s
                                aspect ratio.
                              </p>
                              <table className={styles.printRange}>
                                <thead>
                                  <tr>
                                    <th scope="col">Smallest</th>
                                    <th scope="col">Your max</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td>
                                      <strong>
                                        {formatPrintSize(
                                          printMinSize.heightCm,
                                          printMinSize.widthCm,
                                        )}
                                      </strong>
                                    </td>
                                    <td>
                                      {printMaxSize ? (
                                        <strong>
                                          {formatPrintSize(
                                            printMaxSize.heightCm,
                                            printMaxSize.widthCm,
                                          )}
                                        </strong>
                                      ) : (
                                        <span className={styles.printBoxMuted}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </>
                          ) : (
                            <Callout tone="amber">
                              This image is {imageMeta.width} × {imageMeta.height} px — below the{' '}
                              {MIN_DPI} DPI threshold for any sellable size. Upload a higher
                              resolution version to enable print sales.
                            </Callout>
                          )
                        ) : (
                          <p className={styles.printBoxMuted}>
                            Upload an image to check print eligibility.
                          </p>
                        )}

                        <Button
                          variant="bare"
                          font="dashboard"
                          className={styles.moreInfo}
                          onClick={() => setShowPrintInfoModal(true)}
                          type="button"
                        >
                          More info on print sizes
                        </Button>
                      </div>
                    )}
                  </>
                }
              />

              {/* Per-artwork printing restrictions. Open editions only — limited
                  editions are constrained to their pre-defined variants. Stored in
                  canonical PrintRestrictions shape (`{ allowed: { dimId: ids[] } }`). */}
              {showOpenPrintOptions && (
                <details className={styles.optionsRow}>
                  <summary className={styles.optionsSummary}>
                    <span className={styles.optionsText}>
                      <span className={styles.optionsTitle}>Printing restrictions</span>
                      <span className={styles.optionsHint}>
                        Papers, frame types and mounts buyers can&apos;t choose for this work
                      </span>
                    </span>
                    <span className={styles.optionsToggle}>
                      <span className={styles.whenClosed}>Show options</span>
                      <span className={styles.whenOpen}>Hide options</span>
                      <CaretDown size={14} weight="light" aria-hidden className={styles.caret} />
                    </span>
                  </summary>
                  <div className={styles.optionsBody}>
                    <p className={styles.help}>
                      Advanced — you don&apos;t need to touch this unless you have very specific
                      reasons not to offer a particular paper, frame type or passepartout for this
                      artwork.
                    </p>
                    <p className={styles.help}>
                      We offer many printing options — to keep this simple we only let you veto the
                      three that matter most for editorial control: papers, frame types and the
                      passepartout. Everything that stays checked remains available to buyers.
                    </p>
                    <TpsRestrictionGroup
                      title="Papers"
                      all={TPS_PAPERS.map((p) => ({ id: p.id, label: p.label }))}
                      dimensionId="paper"
                      restrictions={formData.printOptions ?? null}
                      onChange={onPrintOptionsChange}
                      allIds={TPS_PAPERS.map((p) => p.id)}
                    />
                    <TpsRestrictionGroup
                      title="Frame types"
                      all={TPS_FRAME_TYPES.map((f) => ({ id: f.id, label: f.label }))}
                      dimensionId="frameType"
                      restrictions={formData.printOptions ?? null}
                      onChange={onPrintOptionsChange}
                      allIds={TPS_FRAME_TYPES.map((f) => f.id)}
                    />
                    <TpsRestrictionGroup
                      title="Mount (passepartout)"
                      all={TPS_WINDOW_MOUNTS.map((w) => ({ id: w.id, label: w.label }))}
                      dimensionId="windowMount"
                      restrictions={formData.printOptions ?? null}
                      onChange={onPrintOptionsChange}
                      allIds={TPS_WINDOW_MOUNTS.map((w) => w.id)}
                    />
                  </div>
                </details>
              )}

              {/* Per-artwork paper recommendations. Open editions only. Soft hint —
                  does not filter, just surfaces a check-circle in the buyer's paper
                  picker. Vetoed papers are hidden so the artist can't recommend a
                  paper buyers can't pick. */}
              {showOpenPrintOptions && (
                <details className={styles.optionsRow}>
                  <summary className={styles.optionsSummary}>
                    <span className={styles.optionsText}>
                      <span className={styles.optionsTitle}>Printing recommendations</span>
                      <span className={styles.optionsHint}>What you suggest to buyers</span>
                    </span>
                    <span className={styles.optionsToggle}>
                      <span className={styles.whenClosed}>Show options</span>
                      <span className={styles.whenOpen}>Hide options</span>
                      <CaretDown size={14} weight="light" aria-hidden className={styles.caret} />
                    </span>
                  </summary>
                  <div className={styles.optionsBody}>
                    <p className={styles.help}>
                      Advanced — pick the specific paper types you&apos;d recommend for this
                      artwork. Buyers see a checkmark next to your picks in the print wizard; every
                      paper stays available either way.
                    </p>
                    <p className={styles.help}>
                      Recommendations are a soft hint, not a filter. Anything you check here gets a
                      checkmark in the buyer&apos;s paper picker plus a legend explaining it&apos;s
                      your recommendation for best results.
                    </p>
                    <PaperRecommendationGroup
                      papers={TPS_PAPERS.filter((p) =>
                        isTpsDimensionChecked(formData.printOptions ?? null, 'paper', p.id),
                      ).map((p) => ({ id: p.id, label: p.label }))}
                      recommendations={formData.printRecommendations ?? null}
                      onChange={onPrintRecommendationsChange}
                    />
                  </div>
                </details>
              )}
            </EditorPanel>
          )}

          {/* Open-edition go-live. Sits after the printing options because, for an
              open edition, those options stay editable for the life of the work —
              the ONLY thing "Ready to Sell" freezes is the series type (so an
              on-sale open edition can't be flipped to a limited one). A superAdmin
              can reopen it with "Unblock". */}
          {showOpenPrintOptions && (
            <EditorPanel
              section={ARTWORK_SECTION.ready}
              description={
                !seriesTypeLocked
                  ? 'Confirms this artwork is ready to sell. This locks the series type to “Open” — you can’t switch it to a limited edition afterwards. Your price and printing options stay editable.'
                  : // The series-type lock itself is stated once, in Print sales.
                    // This section keeps only what is still actionable.
                    'This open edition is on sale. Price and printing options remain editable.'
              }
              aside={
                !seriesTypeLocked
                  ? onReadyToSell && (
                      <div className={styles.actions}>
                        <Button
                          variant="bare"
                          font="dashboard"
                          className={styles.save}
                          onClick={handleOpenReadyToSell}
                          type="button"
                        >
                          Ready to sell
                        </Button>
                      </div>
                    )
                  : isSuperAdmin &&
                    onUnblock && (
                      <div className={styles.actions}>
                        <Button
                          variant="bare"
                          font="dashboard"
                          className={styles.cancel}
                          onClick={onUnblock}
                          type="button"
                        >
                          Unblock
                        </Button>
                      </div>
                    )
              }
            >
              {!seriesTypeLocked && openPriceError && (
                <p className={styles.sizeError}>
                  Add your price above before putting this artwork on sale.
                </p>
              )}
            </EditorPanel>
          )}

          {/* Audio file - only for sound type */}
          {formData.artworkType === 'sound' && (
            <EditorPanel
              section={ARTWORK_SECTION.audioFile}
              description="Upload an audio file. This sound will be playable in exhibitions."
            >
              <FileInput
                ref={soundInputRef}
                id="artwork-sound-file"
                accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,audio/wav,audio/x-wav,audio/aac,audio/flac"
                onChange={handleSoundFileSelect}
                className={styles.hiddenInput}
              />

              {soundUrl ? (
                <div className={styles.filePreview}>
                  <div className={styles.fileInfo}>
                    <SpeakerHigh size={24} weight="light" aria-hidden className={styles.fileIcon} />
                    <audio controls src={soundUrl} className={styles.audioPlayer}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                  {onSoundRemove && (
                    <Button
                      variant="bare"
                      font="dashboard"
                      className={styles.removeFile}
                      onClick={() => onSoundRemove()}
                      type="button"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className={c(styles.dropzone, isDraggingSound && styles.dragging)}
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
                        variant="bare"
                        font="dashboard"
                        className={styles.selectFile}
                        onClick={(e) => {
                          e.stopPropagation()
                          soundInputRef.current?.click()
                        }}
                        type="button"
                      >
                        Select an audio file
                      </Button>
                      <span className={styles.dropText}>or drag and drop files</span>
                    </>
                  )}
                </div>
              )}

              {soundSizeError && <div className={styles.sizeError}>{soundSizeError}</div>}
              <p className={styles.help}>
                Accepted: MP3, M4A, OGG, WebM, WAV, AAC, FLAC (max 3MB).
              </p>
            </EditorPanel>
          )}

          <form
            id={isPage ? ARTWORK_EDIT_FORM_ID : undefined}
            onSubmit={handleFormSubmit}
            noValidate
            className={styles.form}
          >
            <EditorPanel section={ARTWORK_SECTION.details}>
              <div className={styles.field}>
                <label htmlFor="title" className={styles.label}>
                  Title
                </label>
                <Input
                  id="title"
                  type="text"
                  size="bare"
                  inputClassName={styles.input}
                  value={formData.title}
                  onChange={(e) => {
                    onFormChange('title', e.target.value)
                    if (titleError && e.target.value.trim()) setTitleError(undefined)
                  }}
                  invalid={!!titleError}
                  required
                  aria-describedby="title-help"
                />
                <ErrorText>{titleError}</ErrorText>
                <p id="title-help" className={styles.help}>
                  The display title for your artwork. This will be shown in exhibitions and on your
                  profile.
                </p>
              </div>

              {/* Author + Year */}
              {isImageOrVideo && (
                <div className={styles.authorYear}>
                  <div className={styles.field}>
                    <label htmlFor="author" className={styles.label}>
                      Author
                    </label>
                    <Input
                      id="author"
                      type="text"
                      size="bare"
                      inputClassName={styles.input}
                      value={formData.author}
                      onChange={(e) => onFormChange('author', e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="year" className={styles.label}>
                      Year
                    </label>
                    <Input
                      id="year"
                      type="text"
                      size="bare"
                      inputClassName={styles.input}
                      value={formData.year}
                      onChange={(e) => onFormChange('year', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Technique / Medium */}
              {isImageOrVideo && (
                <div className={styles.field}>
                  <span id="technique-label" className={styles.label}>
                    Technique / medium
                  </span>
                  <RichTextEditor
                    tone="admin"
                    labelledBy="technique-label"
                    content={formData.technique}
                    onChange={(content) => onFormChange('technique', content)}
                    onReady={(html) => onRichTextReady?.('technique', html)}
                    placeholder="e.g. Oil on canvas, mixed media…"
                  />
                </div>
              )}

              {/* Dimensions */}
              {isImage && (
                <div className={styles.field}>
                  <label htmlFor="dimensions" className={styles.label}>
                    Dimensions
                  </label>
                  <Input
                    id="dimensions"
                    type="text"
                    size="bare"
                    className={styles.short}
                    inputClassName={styles.input}
                    value={formData.dimensions}
                    onChange={(e) => onFormChange('dimensions', e.target.value)}
                    placeholder="e.g. 40 × 30 cm"
                    aria-describedby="dimensions-help"
                  />
                  <div id="dimensions-help" className={styles.helpGroup}>
                    <p className={styles.help}>
                      A reference dimension shown on the public artwork page — most relevant for
                      unique physical works (paintings, drawings, sculptures) where the size is
                      fixed. For photography or editions sold as prints, list the original capture
                      size; the actual print sizes are picked by the buyer in the print wizard.
                    </p>
                    <p className={styles.help}>
                      Follow gallery convention: height × width (× depth for 3D works).
                    </p>
                  </div>
                </div>
              )}
            </EditorPanel>

            {/* Text content - for text artworks (plain text only for 3D) */}
            {formData.artworkType === 'text' && (
              <EditorPanel
                section={ARTWORK_SECTION.text}
                description="Plain text content that will be displayed on the 3D stencil."
              >
                <textarea
                  className={styles.textarea}
                  value={formData.textContent}
                  onChange={(e) => onFormChange('textContent', e.target.value)}
                  placeholder="Enter the text to display…"
                  rows={8}
                  aria-labelledby={panelTitleId(ARTWORK_SECTION.text)}
                  aria-describedby="text-content-help"
                />
                <p id="text-content-help" className={styles.help}>
                  Text styling (font, weight, size) is limited in 3D and can be adjusted in the wall
                  panel.
                </p>
              </EditorPanel>
            )}

            {/* Description - for image and video artworks (supports rich text) */}
            {isImageOrVideo && (
              <EditorPanel section={ARTWORK_SECTION.description}>
                <RichTextEditor
                  tone="admin"
                  labelledBy={panelTitleId(ARTWORK_SECTION.description)}
                  content={formData.description}
                  onChange={(content) => onFormChange('description', content)}
                  onReady={(html) => onRichTextReady?.('description', html)}
                  placeholder="About this artwork…"
                />
              </EditorPanel>
            )}

            {/* Featured + exhibition membership */}
            {isImageOrVideo && (
              <EditorPanel section={ARTWORK_SECTION.where}>
                <AdminCheckbox
                  id="artwork-featured"
                  label="Feature on artist profile"
                  description="Highlight this artwork on your public artist profile. Featured artworks appear prominently in your profile's artwork grid."
                  checked={formData.featured}
                  onChange={(checked) => onFormChange('featured', checked)}
                />

                {/* Exhibition membership. Deliberately separate from the 3D room: a
                    work appears here because it was chosen for the show, not because
                    it happens to hang on a wall. Renders only where the caller supplies
                    the artist's exhibitions — the wall-view modal is already inside
                    one show and has no use for it. */}
                {showExhibitions && exhibitions && (
                  <div className={styles.exhibitions}>
                    <div className={styles.field}>
                      {/* A heading (e2e: artwork-exhibition-picker), in the label look. */}
                      <h3 className={styles.label}>Exhibitions</h3>
                      <p className={styles.help}>
                        Choose which exhibitions show this artwork on their page.
                      </p>
                    </div>
                    {exhibitions.map((exhibition) => {
                      const ticked = formData.exhibitionIds.includes(exhibition.id)
                      return (
                        <div
                          key={exhibition.id}
                          data-exhibition-row={exhibition.id}
                          className={styles.exhibitionRow}
                        >
                          <AdminCheckbox
                            id={`artwork-exhibition-${exhibition.id}`}
                            checked={ticked}
                            onChange={(checked) =>
                              onFormChange(
                                'exhibitionIds',
                                checked
                                  ? [...formData.exhibitionIds, exhibition.id]
                                  : formData.exhibitionIds.filter((id) => id !== exhibition.id),
                              )
                            }
                            label={
                              exhibition.published
                                ? exhibition.mainTitle
                                : `${exhibition.mainTitle} (draft)`
                            }
                          />
                          {/* Only when the work is on this show's page and the show has
                              sections to offer — otherwise the form reads as before. */}
                          {ticked && exhibition.sections.length > 0 && (
                            <SelectDropdown
                              className={styles.sectionSelect}
                              options={[
                                { value: '', label: 'No section' },
                                ...exhibition.sections.map((s) => ({
                                  value: s.id,
                                  label: s.title,
                                })),
                              ]}
                              value={formData.exhibitionSections[exhibition.id] ?? ''}
                              onChange={(value) =>
                                onFormChange('exhibitionSections', {
                                  ...formData.exhibitionSections,
                                  [exhibition.id]: value || null,
                                })
                              }
                            />
                          )}
                        </div>
                      )
                    })}
                    <p className={styles.help}>
                      Independent of the 3D space. An artwork can appear on the page without hanging
                      in the room. Sections are set up on each exhibition&apos;s settings page.
                    </p>
                  </div>
                )}
              </EditorPanel>
            )}

            {/* Gallery-curated sales imagery, admin only, and only once the
                artwork exists — an upload needs an id to attach to. */}
            {showSupplementary && artworkId && (
              <EditorPanel
                section={ARTWORK_SECTION.media}
                description={
                  <>
                    Close-ups, print mockups, the certificate, a short film &mdash; the evidence
                    that a physical object exists.
                  </>
                }
              >
                <ArtworkMediaManager artworkId={artworkId} />
              </EditorPanel>
            )}

            {error && (
              <Callout tone="red" role="alert">
                {error}
              </Callout>
            )}

            {/* The studio page's save bar submits this form by its id; the wall
                view's overlay keeps its own row. */}
            {!isPage && (
              <div className={styles.actions}>
                <Button
                  variant="bare"
                  font="dashboard"
                  className={styles.cancel}
                  onClick={onCancel}
                  type="button"
                >
                  Cancel
                </Button>
                <Button variant="bare" font="dashboard" className={styles.save} type="submit">
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Print sizes info modal */}
      {showPrintInfoModal && (
        <Modal
          tone="admin"
          titleId={PRINT_SIZES_TITLE_ID}
          onClose={() => setShowPrintInfoModal(false)}
        >
          <div className={styles.printModal}>
            <h2 id={PRINT_SIZES_TITLE_ID} className={styles.printModalTitle}>
              Print size requirements
            </h2>
            <p className={styles.printModalDescription}>
              Prints are sold at custom sizes, aspect-locked to your file. Buyers pick any width or
              height within your file&apos;s allowed range, and the other side auto-locks to your
              artwork&apos;s proportions. Prints ship at {MIN_DPI} DPI or higher.
            </p>

            {imageMeta && printMinSize && (
              <>
                <h3 className={styles.printModalSubtitle}>Your file</h3>
                <dl className={styles.printModalFacts}>
                  <dt>Resolution:</dt>
                  <dd>
                    <strong>
                      {imageMeta.width} × {imageMeta.height} px
                    </strong>
                  </dd>
                  <dt>Smallest sellable:</dt>
                  <dd>
                    <strong>{formatPrintSize(printMinSize.heightCm, printMinSize.widthCm)}</strong>
                  </dd>
                  <dt>Largest at {MIN_DPI} DPI:</dt>
                  <dd>
                    {printMaxSize ? (
                      <strong>
                        {formatPrintSize(printMaxSize.heightCm, printMaxSize.widthCm)}
                      </strong>
                    ) : (
                      <span className={styles.printBoxMuted}>—</span>
                    )}
                  </dd>
                </dl>
              </>
            )}
            <div className={styles.actions}>
              <Button
                variant="bare"
                font="dashboard"
                className={styles.save}
                onClick={() => setShowPrintInfoModal(false)}
                type="button"
              >
                Got it
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
