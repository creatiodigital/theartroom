/**
 * Prodigi SKU derivation. Used by downstream order-creation code (admin
 * tooling, payment intent, manual fulfillment dashboard). The wizard
 * never imports this — SKUs are an artefact of how Prodigi prices and
 * fulfills orders, not part of the wizard's contract.
 *
 * SKU families in play (verified against live Prodigi, Apr 2026):
 *   - Unframed:                  GLOBAL-<PAPER_PREFIX>-<INCH_SIZE>
 *   - Classic framed + EMA:      GLOBAL-CFP[M]-<INCH_SIZE>
 *   - Classic framed + other:    FRA-CLA-<PAPER>-<MOUNT>-ACRY-<CM_SIZE>
 *   - Box framed (any paper):    GLOBAL-BOX-<INCH_SIZE>  — paper, mount,
 *                                glaze are variant ATTRIBUTES on this
 *                                SKU family (not tokens in the SKU).
 *
 * Glazing is always Perspex (ACRY) by spec. Frame color and mount color
 * are runtime attributes on the variant, not part of the SKU itself.
 */
import {
  getProdigiFormat,
  getProdigiFrameColor,
  getProdigiMount,
  getProdigiPaper,
  getProdigiSize,
  type ProdigiConfig,
} from './config'
import {
  PRODIGI_FORMATS,
  PRODIGI_FRAME_COLORS,
  PRODIGI_MOUNTS,
  PRODIGI_PAPERS,
  PRODIGI_SIZES,
} from './data'

export type ResolvedSku = {
  sku: string
  attributes: Record<string, string>
}

export function resolveProdigiSku(config: ProdigiConfig): ResolvedSku {
  const paper = getProdigiPaper(config.paperId)
  const size = getProdigiSize(config.sizeId)
  const format = getProdigiFormat(config.formatId)
  const mount = getProdigiMount(config.mountId)
  const color = getProdigiFrameColor(config.frameColorId)

  if (!format.framed) {
    return {
      sku: `${paper.unframedPrefix}-${size.inchToken}`,
      attributes: {},
    }
  }

  const attributes: Record<string, string> = { color: color.prodigiColor }
  if (mount.id !== 'none') attributes.mountColor = mount.prodigiMountColor

  if (config.formatId === 'classic-framed' && paper.id === 'fine-art-matte') {
    const base = mount.id === 'none' ? 'GLOBAL-CFP' : 'GLOBAL-CFPM'
    return { sku: `${base}-${size.inchToken}`, attributes }
  }

  if (config.formatId === 'classic-framed') {
    return {
      sku: `FRA-CLA-${paper.framedToken}-${mount.prodigiToken}-ACRY-${size.cmToken}`,
      attributes,
    }
  }

  return {
    sku: `GLOBAL-BOX-${size.inchToken}`,
    attributes,
  }
}

/**
 * Every distinct Prodigi SKU the catalog can possibly produce. Used by
 * the catalog pre-fetch to enumerate what the wizard might need.
 *
 * Frame color and mount *color* are variant attributes inside a SKU's
 * product response, not part of the SKU itself — so enumerating them is
 * unnecessary. We iterate paper × format × size × mount, take the SKU
 * from resolveProdigiSku(), and dedupe.
 */
export function enumerateProdigiSkus(): string[] {
  const set = new Set<string>()
  for (const paper of PRODIGI_PAPERS) {
    for (const format of PRODIGI_FORMATS) {
      for (const size of PRODIGI_SIZES) {
        if (!format.framed) {
          const { sku } = resolveProdigiSku({
            paperId: paper.id,
            formatId: format.id,
            sizeId: size.id,
            frameColorId: PRODIGI_FRAME_COLORS[0].id,
            mountId: 'none',
            orientation: 'portrait',
          })
          set.add(sku)
          continue
        }
        for (const mount of PRODIGI_MOUNTS) {
          const { sku } = resolveProdigiSku({
            paperId: paper.id,
            formatId: format.id,
            sizeId: size.id,
            frameColorId: PRODIGI_FRAME_COLORS[0].id,
            mountId: mount.id,
            orientation: 'portrait',
          })
          set.add(sku)
        }
      }
    }
  }
  return Array.from(set)
}
