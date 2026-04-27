/**
 * Convert Prodigi's internal data + a fetched SKU/variant catalog into
 * the canonical, provider-agnostic `Catalog` shape consumed by the
 * wizard.
 */
import type { AvailabilityCheck, Catalog, EnumDimension, Option, SizeOption } from '../types'
import { configToProdigi, type ProdigiConfig } from './config'
import {
  PRODIGI_BOX_EXTRA_DEPTH_CM,
  PRODIGI_CLASSIC_MOULDING_CM,
  PRODIGI_FORMATS,
  PRODIGI_FRAME_COLORS,
  PRODIGI_MOUNTS,
  PRODIGI_PAPERS,
  PRODIGI_SIZES,
} from './data'
import { canSwap, collectAllCountries, getSizeFit, isSizePrintEligible } from './availability'
import type { ProdigiSkuData } from './loadCatalog'

type BuildInput = {
  skus: ProdigiSkuData[]
  imageWidthPx: number
  imageHeightPx: number
}

export function buildProdigiCatalog({ skus, imageWidthPx, imageHeightPx }: BuildInput): Catalog {
  const aspectRatio = imageWidthPx > 0 && imageHeightPx > 0 ? imageWidthPx / imageHeightPx : 1

  // ── Paper ────────────────────────────────────────────────────
  const paperOptions: Option[] = PRODIGI_PAPERS.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    visual: { paperRoughness: p.paperRoughness },
  }))

  // ── Format ──────────────────────────────────────────────────
  const formatOptions: Option[] = PRODIGI_FORMATS.map((f) => ({
    id: f.id,
    label: f.label,
    description: f.description,
    tooltipImageUrl: f.tooltipImageUrl,
    visual: {
      framed: f.framed,
      mouldingWidthCm: f.framed ? PRODIGI_CLASSIC_MOULDING_CM.width : 0,
      mouldingDepthCm: f.framed
        ? PRODIGI_CLASSIC_MOULDING_CM.depth +
          (f.id === 'box-framed' ? PRODIGI_BOX_EXTRA_DEPTH_CM : 0)
        : 0,
    },
  }))

  // ── Frame color ─────────────────────────────────────────────
  const frameColorOptions: Option[] = PRODIGI_FRAME_COLORS.map((c) => ({
    id: c.id,
    label: c.label,
    visual: { frameColorHex: c.hex, frameRoughness: c.roughness },
  }))

  // ── Mount ───────────────────────────────────────────────────
  const mountOptions: Option[] = PRODIGI_MOUNTS.map((m) => ({
    id: m.id,
    label: m.label,
    visual: { hasMat: m.id !== 'none', matBorderCm: m.borderCm, matColorHex: '#f6f3ec' },
  }))

  // ── Size ────────────────────────────────────────────────────
  // Prodigi has fixed presets and no custom sizes. To honour the "no
  // crop, no pad — ever" promise we drop any preset whose aspect
  // ratio doesn't match the artwork (perfect/close only). Mismatched
  // presets are intentionally absent; if none survive for an artwork,
  // the artist UI nudges them toward TPS (which supports custom sizes
  // that always fit).
  const sizeOptions: SizeOption[] = PRODIGI_SIZES.map((s) => {
    const fit = getSizeFit(s, aspectRatio)
    return {
      id: s.id,
      label: s.label,
      widthCm: s.widthCm,
      heightCm: s.heightCm,
      fit,
      printEligible: isSizePrintEligible(s, imageWidthPx, imageHeightPx),
    }
  }).filter((s) => s.fit !== 'mismatch')

  const dimensions: Catalog['dimensions'] = [
    {
      kind: 'enum',
      id: 'paper',
      label: 'Paper',
      options: paperOptions,
    } satisfies EnumDimension,
    {
      kind: 'enum',
      id: 'format',
      label: 'Format',
      options: formatOptions,
    } satisfies EnumDimension,
    { kind: 'size', id: 'size', label: 'Size', options: sizeOptions },
    {
      kind: 'enum',
      id: 'color',
      label: 'Frame color',
      options: frameColorOptions,
      visibleWhen: { dimensionId: 'format', valueIn: ['classic-framed', 'box-framed'] },
    } satisfies EnumDimension,
    {
      kind: 'enum',
      id: 'mount',
      label: 'Passepartout',
      options: mountOptions,
      visibleWhen: { dimensionId: 'format', valueIn: ['classic-framed', 'box-framed'] },
    } satisfies EnumDimension,
    { kind: 'orientation', id: 'orientation', label: 'Orientation' },
  ]

  return {
    providerId: 'prodigi',
    currency: 'EUR',
    dimensions,
    supportedCountries: collectAllCountries(skus),
    providerData: { skus } satisfies ProdigiProviderData,
  }
}

export type ProdigiProviderData = {
  skus: ProdigiSkuData[]
}

/**
 * Wraps a fetched Prodigi catalog (the raw SKU/variant payload) in the
 * canonical `AvailabilityCheck` predicate. Closure captures the SKU
 * data so the wizard can call this synchronously per option without
 * additional adapter awareness.
 */
export function buildProdigiAvailability(skus: ProdigiSkuData[]): AvailabilityCheck {
  return (dimensionId, optionId, config, country) => {
    if (!country) return true
    const prodigi = configToProdigi(config)
    return canSwap(prodigi, dimensionId, optionId, country, skus)
  }
}

/** Read the SKUs back out of an already-built Prodigi catalog's providerData. */
export function readProdigiProviderData(catalog: Catalog): ProdigiProviderData {
  const data = catalog.providerData as ProdigiProviderData | undefined
  if (!data || !Array.isArray(data.skus)) {
    throw new Error('[Prodigi] catalog missing providerData.skus')
  }
  return data
}

/** Re-export for the page route — needed when picking a starting config. */
export type { ProdigiConfig }
