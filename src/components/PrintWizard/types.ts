export type PaperId = 'fine-art-matte' | 'museum-cotton-rag'

export type FormatId = 'unframed' | 'classic-framed' | 'box-framed'

export type FrameColorId = 'black' | 'white' | 'oak' | 'walnut'

export type MountId = 'none' | 'snow-white'

export type SizeId = '20x25' | '20x30' | '28x36' | '30x40' | '40x50' | '50x70' | '60x80'

export type SizeUnit = 'cm' | 'inches'

export type PrintConfig = {
  paperId: PaperId
  formatId: FormatId
  sizeId: SizeId
  /** Only relevant when formatId is a framed variant. */
  frameColorId: FrameColorId
  /** Only relevant when formatId is a framed variant. */
  mountId: MountId
  unit: SizeUnit
}

export type PaperOption = {
  id: PaperId
  label: string
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

export type WizardArtwork = {
  slug: string
  title: string
  artistName: string
  year?: string
  imageUrl: string
  /** Pixel dimensions of the source image — used for aspect-ratio filtering. */
  originalWidthPx: number
  originalHeightPx: number
  /** Optional base price (in cents) the artist charges per sale. */
  artistPriceCents?: number
}
