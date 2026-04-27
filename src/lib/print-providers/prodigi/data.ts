/**
 * Prodigi-specific catalog data. Lives entirely inside the Prodigi
 * adapter — the wizard never imports from this file.
 *
 * Keeping each piece (papers, formats, sizes, …) typed at the adapter
 * level rather than as canonical wizard types lets us encode all the
 * Prodigi-specific knobs (SKU tokens, SKU prefixes, shipping
 * supplements) without leaking them upstream.
 */

export type ProdigiPaper = {
  id: 'fine-art-matte' | 'museum-cotton-rag' | 'german-etching'
  label: string
  description: string
  /** Prefix for the unframed SKU family (uses inch size tokens). */
  unframedPrefix: string
  /** Token used in FRA-*-<TOKEN>-... framed SKUs (cm size tokens). */
  framedToken: string
  /** Paper roughness for the 3D preview. */
  paperRoughness: number
}

export type ProdigiFormat = {
  id: 'unframed' | 'classic-framed' | 'box-framed'
  label: string
  description: string
  framed: boolean
  tooltipImageUrl?: string
}

export type ProdigiFrameColor = {
  id: 'black' | 'white' | 'oak' | 'walnut'
  label: string
  /** Value sent as the `color` attribute on the Prodigi order item. */
  prodigiColor: string
  /** Hex used for the 3D preview. */
  hex: string
  /** Material roughness for the 3D preview. */
  roughness: number
}

export type ProdigiMount = {
  id: 'none' | 'snow-white'
  label: string
  /** SKU token: NM for none, MOUNT1 for standard 1.4mm mount. */
  prodigiToken: 'NM' | 'MOUNT1'
  /** Value sent as the `mountColor` attribute when mounted. */
  prodigiMountColor: string
  /** Mat border width (cm) used by the 3D preview & size schema. */
  borderCm: number
}

export type ProdigiSize = {
  id: '20x25' | '20x30' | '28x36' | '30x40' | '40x50' | '50x70' | '60x80'
  widthCm: number
  heightCm: number
  /** Cm-form token used by FRA-*-...-<SIZE> SKUs. E.g. '30X40'. */
  cmToken: string
  /** Inch-form token used by GLOBAL-*-<SIZE> SKUs. E.g. '12X16'. */
  inchToken: string
  label: string
}

export const PRODIGI_PAPERS: ProdigiPaper[] = [
  {
    id: 'fine-art-matte',
    label: 'Enhanced Matte Art 200 gsm',
    description:
      'Fine art matte paper, 200 gsm. Smooth satin finish with excellent color depth — our everyday fine-art standard.',
    unframedPrefix: 'GLOBAL-FAP',
    framedToken: 'EMA',
    paperRoughness: 0.7,
  },
  {
    id: 'museum-cotton-rag',
    label: 'Hahnemühle Photo Rag 308 gsm',
    description:
      '100% cotton, archival museum cotton rag. Smooth matte surface with deep blacks and accurate color — the collector choice for photography and fine-art reproduction.',
    unframedPrefix: 'GLOBAL-HPR',
    framedToken: 'HPR',
    paperRoughness: 0.85,
  },
  {
    id: 'german-etching',
    label: 'Hahnemühle German Etching 310 gsm',
    description:
      'Heavily textured mould-made fine-art paper with pronounced tooth and warm-white tone. Favoured for black-and-white and painterly work where surface character matters.',
    unframedPrefix: 'GLOBAL-HGE',
    framedToken: 'HGE',
    paperRoughness: 0.9,
  },
]

export const PRODIGI_FORMATS: ProdigiFormat[] = [
  {
    id: 'unframed',
    label: 'Unframed print',
    description: 'Just the print, rolled or flat-packed.',
    framed: false,
  },
  {
    id: 'classic-framed',
    label: 'Classic frame',
    description:
      'A slim, flush wooden moulding with Perspex glazing — ready to hang. The print sits behind the glass for a clean, gallery-ready finish that suits any interior.',
    framed: true,
    tooltipImageUrl: '/assets/helpers/classic-frame.png',
  },
  {
    id: 'box-framed',
    label: 'Box frame',
    description:
      'Crafted from solid, hand-stained wood and finished with a premium fine art print, our box framed prints measure 20mm on the front face, with a 33mm depth from the wall for a clean, contemporary shadow-line look. A specialist wax finish brings out the natural grain and warmth of the wood.',
    framed: true,
    tooltipImageUrl: '/assets/helpers/box-frame.png',
  },
]

export const PRODIGI_FRAME_COLORS: ProdigiFrameColor[] = [
  { id: 'black', label: 'Black', prodigiColor: 'black', hex: '#0b0b0b', roughness: 0.35 },
  { id: 'white', label: 'White', prodigiColor: 'white', hex: '#f2f2f2', roughness: 0.55 },
  { id: 'oak', label: 'Natural oak', prodigiColor: 'natural', hex: '#c8a27a', roughness: 0.7 },
  { id: 'walnut', label: 'Walnut', prodigiColor: 'brown', hex: '#5a3b28', roughness: 0.7 },
]

export const PRODIGI_MOUNTS: ProdigiMount[] = [
  { id: 'none', label: 'No mount', prodigiToken: 'NM', prodigiMountColor: '', borderCm: 0 },
  {
    id: 'snow-white',
    label: 'With mount',
    prodigiToken: 'MOUNT1',
    prodigiMountColor: 'Snow white',
    borderCm: 5.0,
  },
]

// Display labels follow art-gallery convention: height × width.
// Internal widthCm/heightCm fields are unchanged — only the human-facing
// `label` flips so SKU resolution, DPI math and wizard logic stay intact.
export const PRODIGI_SIZES: ProdigiSize[] = [
  {
    id: '20x25',
    widthCm: 20,
    heightCm: 25,
    cmToken: '20X25',
    inchToken: '8X10',
    label: '25×20 cm (10×8″)',
  },
  {
    id: '20x30',
    widthCm: 20,
    heightCm: 30,
    cmToken: '20X30',
    inchToken: '8X12',
    label: '30×20 cm (12×8″)',
  },
  {
    id: '28x36',
    widthCm: 28,
    heightCm: 36,
    cmToken: '28X36',
    inchToken: '11X14',
    label: '36×28 cm (14×11″)',
  },
  {
    id: '30x40',
    widthCm: 30,
    heightCm: 40,
    cmToken: '30X40',
    inchToken: '12X16',
    label: '40×30 cm (16×12″)',
  },
  {
    id: '40x50',
    widthCm: 40,
    heightCm: 50,
    cmToken: '40X50',
    inchToken: '16X20',
    label: '50×40 cm (20×16″)',
  },
  {
    id: '50x70',
    widthCm: 50,
    heightCm: 70,
    cmToken: '50X70',
    inchToken: '20X28',
    label: '70×50 cm (28×20″)',
  },
  {
    id: '60x80',
    widthCm: 60,
    heightCm: 80,
    cmToken: '60X80',
    inchToken: '24X32',
    label: '80×60 cm (32×24″)',
  },
]

// Frame moulding measurements (cm) used by the 3D preview.
export const PRODIGI_CLASSIC_MOULDING_CM = { width: 2.0, depth: 2.2 }
export const PRODIGI_BOX_EXTRA_DEPTH_CM = 2.5

// ── EU VAT (Spain-flat for now; see project_vat_todo memory) ─────
export const PRODIGI_VAT_RATE = 0.21
export const PRODIGI_GALLERY_MARKUP_RATE = 0.45

export const PRODIGI_EU_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
])

// Rough per-SKU cost estimates in EUR cents, derived from quote probes
// against production. Fallback for the wizard summary when live quotes
// are unavailable; live Prodigi quotes are always preferred.
export const PRODIGI_COST_TABLE: Record<
  string,
  Record<string, Partial<Record<ProdigiSize['id'], number>>>
> = {
  'fine-art-matte': {
    unframed: { '20x25': 1100, '20x30': 1300, '28x36': 1900, '30x40': 2300, '40x50': 3500 },
    'classic-framed': { '30x40': 6100, '40x50': 8100, '50x70': 10600, '60x80': 12000 },
    'box-framed': { '30x40': 7500, '40x50': 8974, '50x70': 11500, '60x80': 13500 },
  },
  'museum-cotton-rag': {
    unframed: { '20x30': 2300, '28x36': 4300, '30x40': 5000, '40x50': 8000 },
    'classic-framed': { '30x40': 7593, '40x50': 10355, '50x70': 13461, '60x80': 14727 },
    'box-framed': { '30x40': 8700, '40x50': 11600, '50x70': 14500, '60x80': 16000 },
  },
}

export const PRODIGI_MOUNT_SUPPLEMENT_CENTS = 1000

// Min DPI for prints. Mirrors MIN_DPI in the artwork edit form.
export const PRODIGI_MIN_PRINT_DPI = 300
export const CM_PER_INCH = 2.54
