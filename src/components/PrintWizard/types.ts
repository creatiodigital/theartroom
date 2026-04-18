export type PaperId = 'fine-art-matte' | 'museum-cotton-rag' | 'german-etching'

export type FormatId = 'unframed' | 'classic-framed' | 'box-framed'

export type FrameColorId = 'black' | 'white' | 'oak' | 'walnut'

export type MountId = 'none' | 'snow-white'

export type SizeId = '20x25' | '20x30' | '28x36' | '30x40' | '40x50' | '50x70' | '60x80'

export type SizeUnit = 'cm' | 'inches'

export type Orientation = 'portrait' | 'landscape'

export type PrintConfig = {
  paperId: PaperId
  formatId: FormatId
  sizeId: SizeId
  /** Only relevant when formatId is a framed variant. */
  frameColorId: FrameColorId
  /** Only relevant when formatId is a framed variant. */
  mountId: MountId
  unit: SizeUnit
  /** How the print will be hung. Defaults to the image's natural orientation. */
  orientation: Orientation
}

export type PaperOption = {
  id: PaperId
  /**
   * Technical paper name + weight. Used consistently in the wizard,
   * the artist's restrictions UI, and the Certificate of Authenticity
   * — pro photographers recognise these, not marketing labels.
   */
  label: string
  /** Full paragraph shown next to the wizard option. */
  description: string
  /** Prefix for the unframed SKU family (uses inch size tokens). */
  prodigiUnframedPrefix: string
  /** Token used in FRA-*-<TOKEN>-... framed SKUs (uses cm size tokens). */
  prodigiFramedToken: string
}

export type FormatOption = {
  id: FormatId
  label: string
  description: string
  framed: boolean
}

export type FrameColorOption = {
  id: FrameColorId
  label: string
  /** Value sent as the `color` attribute on the Prodigi order item. */
  prodigiColor: string
  /** Hex used for the 3D preview. */
  hex: string
  /** Material roughness for the 3D preview. */
  roughness: number
}

export type MountOption = {
  id: MountId
  label: string
  /** SKU token: NM for none, MOUNT1 for standard 1.4mm mount. */
  prodigiToken: 'NM' | 'MOUNT1'
  /** Value sent as the `mountColor` attribute when mounted. */
  prodigiMountColor: string
  /** Mat border width (cm) used by the 3D preview & size schema. */
  borderCm: number
}

export type SizeOption = {
  id: SizeId
  widthCm: number
  heightCm: number
  /** Cm-form token used by FRA-*-...-<SIZE> SKUs. E.g. '30X40'. */
  cmToken: string
  /** Inch-form token used by GLOBAL-*-<SIZE> SKUs. E.g. '12X16'. */
  inchToken: string
  label: string
}

/**
 * Artist-controlled restrictions on which print options a buyer sees in
 * the wizard for one specific artwork. Every field is optional and an
 * `undefined` / missing field means "all values allowed" (current
 * default behavior). A non-empty array is an allow-list.
 *
 * Stored as JSON on `Artwork.printOptions`. Buyers never see this
 * object — the wizard just renders a filtered option list. Server-side
 * re-check in `createPaymentIntent` defends against stale wizard state.
 */
export type PrintOptions = {
  allowedPaperIds?: PaperId[]
  allowedFormatIds?: FormatId[]
  allowedSizeIds?: SizeId[]
  allowedFrameColorIds?: FrameColorId[]
  allowedMountIds?: MountId[]
}

export type WizardArtwork = {
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  /** Pixel dimensions of the source image — used for aspect-ratio filtering. */
  originalWidthPx: number
  originalHeightPx: number
  /** The artist's cut (in cents) per print sale. Set per-artwork by the artist. */
  printPriceCents: number
  /** Artist-chosen restrictions on which papers/formats/sizes/etc this artwork is sold with. */
  printOptions?: PrintOptions | null
}
