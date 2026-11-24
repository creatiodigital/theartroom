/**
 * Pedestals (docs/objects "In the 3D space", objects-pedestals.dc.html): parametric, any size. The
 * catalogue of shapes and materials, and the geometry facts the floor needs (the outline at the
 * base, the top an Object sits on). Pure and client-safe: the meshes are built from these in
 * `components/scene/floor/PedestalMesh.tsx`.
 *
 * Units: cm. Plan coordinates: x across (width), z in depth, origin at the pedestal's centre.
 */

export type PedestalShapeId =
  | 'cube'
  | 'box'
  | 'slab'
  | 'longTable'
  | 'cylinder'
  | 'disc'
  | 'hexagon'
  | 'octagon'
  | 'tapered'
  | 'taperedRound'
  | 'stepped'
  | 'softBox'
  | 'halfRound'
  | 'corner'
  | 'table'

export type PedestalShape = {
  id: PedestalShapeId
  label: string
  sub: string
  /** Round shapes take a diameter (w = d), not a width and a depth. */
  round: boolean
  /** Equal sides (the cube): one size for all three. */
  equal?: boolean
  /** The size a new one starts at (cm). */
  defaults: { w: number; d: number; h: number }
}

export const PEDESTAL_SHAPES: readonly PedestalShape[] = [
  {
    id: 'cube',
    label: 'Cube',
    sub: 'Equal sides',
    round: false,
    equal: true,
    defaults: { w: 45, d: 45, h: 45 },
  },
  {
    id: 'box',
    label: 'Box',
    sub: 'Any width, depth, height',
    round: false,
    defaults: { w: 40, d: 40, h: 90 },
  },
  {
    id: 'slab',
    label: 'Slab',
    sub: 'Low platform',
    round: false,
    defaults: { w: 120, d: 80, h: 15 },
  },
  {
    id: 'longTable',
    label: 'Long table',
    sub: 'Long and low',
    round: false,
    defaults: { w: 200, d: 50, h: 45 },
  },
  {
    id: 'cylinder',
    label: 'Cylinder',
    sub: 'Round',
    round: true,
    defaults: { w: 45, d: 45, h: 90 },
  },
  {
    id: 'disc',
    label: 'Disc',
    sub: 'Low and round',
    round: true,
    defaults: { w: 120, d: 120, h: 15 },
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    sub: 'Six sides',
    round: true,
    defaults: { w: 50, d: 50, h: 80 },
  },
  {
    id: 'octagon',
    label: 'Octagon',
    sub: 'Eight sides',
    round: true,
    defaults: { w: 50, d: 50, h: 80 },
  },
  {
    id: 'tapered',
    label: 'Tapered',
    sub: 'Narrower at the top',
    round: false,
    defaults: { w: 45, d: 45, h: 90 },
  },
  {
    id: 'taperedRound',
    label: 'Tapered round',
    sub: 'Round, narrower at the top',
    round: true,
    defaults: { w: 50, d: 50, h: 88 },
  },
  {
    id: 'stepped',
    label: 'Stepped',
    sub: 'Two tiers',
    round: false,
    defaults: { w: 64, d: 64, h: 82 },
  },
  {
    id: 'softBox',
    label: 'Soft box',
    sub: 'Rounded corners',
    round: false,
    defaults: { w: 45, d: 45, h: 86 },
  },
  {
    id: 'halfRound',
    label: 'Half round',
    sub: 'Flat back, for a wall',
    round: false,
    defaults: { w: 60, d: 30, h: 86 },
  },
  {
    id: 'corner',
    label: 'Corner',
    sub: 'Quarter round, for a corner',
    round: false,
    defaults: { w: 45, d: 45, h: 86 },
  },
  {
    id: 'table',
    label: 'Table',
    sub: 'Top on four legs',
    round: false,
    defaults: { w: 120, d: 80, h: 75 },
  },
]

export const pedestalShape = (id: string): PedestalShape =>
  PEDESTAL_SHAPES.find((s) => s.id === id) ?? PEDESTAL_SHAPES[1]

// ── Geometry facts ─────────────────────────────────────────────────────────

/** How much narrower a tapered top is than its base. */
export const TAPER = 0.7
/** The stepped pedestal's upper tier: its share of the base, and where it starts. */
export const STEP = { top: 0.6, at: 0.27 }
/** The table's top thickness and leg side (cm). */
export const TABLE = { top: 6, leg: 5 }
/** A soft box's corner radius as a share of its smaller side. */
export const SOFT_RADIUS = 0.22

type Pt = [number, number]

const rect = (w: number, d: number): Pt[] => [
  [-w / 2, -d / 2],
  [w / 2, -d / 2],
  [w / 2, d / 2],
  [-w / 2, d / 2],
]

const ngon = (n: number, rx: number, rz: number, a0 = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2
    return [Math.cos(a) * rx, Math.sin(a) * rz] as Pt
  })

const roundedRect = (w: number, d: number, r: number): Pt[] => {
  const pts: Pt[] = []
  const corners: [number, number, number][] = [
    [w / 2 - r, d / 2 - r, 0],
    [-w / 2 + r, d / 2 - r, Math.PI / 2],
    [-w / 2 + r, -d / 2 + r, Math.PI],
    [w / 2 - r, -d / 2 + r, Math.PI * 1.5],
  ]
  for (const [x, z, a] of corners) {
    for (let i = 0; i <= 6; i++) {
      const t = a + (i / 6) * (Math.PI / 2)
      pts.push([x + Math.cos(t) * r, z + Math.sin(t) * r])
    }
  }
  return pts
}

/**
 * The outline at the base, in plan (cm, around the centre). Half round: the flat back along −z
 * (to sit against a wall), the curve toward +z. Corner: the right angle at the back left.
 */
export function pedestalOutline(shape: PedestalShapeId, w: number, d: number): Pt[] {
  switch (shape) {
    case 'cylinder':
    case 'disc':
    case 'taperedRound':
      return ngon(48, w / 2, d / 2)
    case 'hexagon':
      return ngon(6, w / 2, d / 2, Math.PI / 6)
    case 'octagon':
      return ngon(8, w / 2, d / 2, Math.PI / 8)
    case 'softBox':
      return roundedRect(w, d, Math.min(w, d) * SOFT_RADIUS)
    case 'halfRound': {
      const pts: Pt[] = []
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI - (i / 24) * Math.PI
        pts.push([Math.cos(a) * (w / 2), -d / 2 + Math.sin(a) * d])
      }
      return pts
    }
    case 'corner': {
      const pts: Pt[] = [[-w / 2, -d / 2]]
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * (Math.PI / 2)
        pts.push([-w / 2 + Math.cos(a) * w, -d / 2 + Math.sin(a) * d])
      }
      return pts
    }
    default:
      return rect(w, d)
  }
}

/**
 * The surface an Object stands on: its outline in plan (around the pedestal's centre) and its
 * height (cm). The top follows the shape: smaller for Tapered, the upper tier for Stepped, the
 * tabletop for Table, the base outline otherwise.
 */
export function pedestalTop(
  shape: PedestalShapeId,
  w: number,
  d: number,
  h: number,
): { outline: Pt[]; height: number } {
  switch (shape) {
    case 'tapered':
    case 'taperedRound':
      return {
        outline: pedestalOutline(shape, w * TAPER, d * TAPER),
        height: h,
      }
    case 'stepped':
      return { outline: rect(w * STEP.top, d * STEP.top), height: h }
    default:
      return { outline: pedestalOutline(shape, w, d), height: h }
  }
}

/** True when a point (cm, around the pedestal's centre) is on a top's outline (ray casting). */
export function insideOutline(outline: Pt[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i]
    const [xj, zj] = outline[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

// ── Materials ──────────────────────────────────────────────────────────────

export type PedestalFinish = 'matte' | 'satin' | 'gloss'
export type PedestalEdges = 'sharp' | 'soft' | 'round'

export type PedestalColour = { id: string; label: string; hex: string }

export type PedestalMaterial = {
  id: 'painted' | 'wood' | 'plastic' | 'concrete' | 'stone' | 'metal' | 'acrylic' | 'mirror'
  label: string
  /** The colour picker's title: "Colour", "Wood", "Tone", "Stone", "Metal", "Tint", "Finish". */
  colourTitle: string
  colours: PedestalColour[]
  /** Any colour (a custom hex) as well as the list. */
  anyColour: boolean
  /** Matte / Satin / Gloss. */
  finishes: boolean
  /** The PBR basics a renderer starts from. */
  roughness: number
  metalness: number
  /** 0..1, for acrylic. */
  opacity?: number
}

const PAINT: PedestalColour[] = [
  { id: 'white', label: 'White', hex: '#f7f7f5' },
  { id: 'offWhite', label: 'Off-white', hex: '#ece7dc' },
  { id: 'sand', label: 'Sand', hex: '#d8c9ad' },
  { id: 'lightGrey', label: 'Light grey', hex: '#c9c9c7' },
  { id: 'darkGrey', label: 'Dark grey', hex: '#5a5a5a' },
  { id: 'black', label: 'Black', hex: '#1c1c1c' },
  { id: 'terracotta', label: 'Terracotta', hex: '#b8644a' },
  { id: 'ochre', label: 'Ochre', hex: '#c99a3e' },
  { id: 'olive', label: 'Olive', hex: '#7a7a4e' },
  { id: 'sage', label: 'Sage', hex: '#a3b09a' },
  { id: 'blue', label: 'Blue', hex: '#3d5a80' },
  { id: 'red', label: 'Red', hex: '#a3272f' },
]

export const PEDESTAL_MATERIALS: readonly PedestalMaterial[] = [
  {
    id: 'painted',
    label: 'Painted',
    colourTitle: 'Colour',
    colours: PAINT,
    anyColour: true,
    finishes: true,
    roughness: 0.85,
    metalness: 0,
  },
  {
    id: 'wood',
    label: 'Wood',
    colourTitle: 'Wood',
    anyColour: false,
    finishes: false,
    roughness: 0.7,
    metalness: 0,
    colours: [
      { id: 'birch', label: 'Birch', hex: '#e2cfae' },
      { id: 'ash', label: 'Ash', hex: '#d8c3a0' },
      { id: 'oak', label: 'Oak', hex: '#c5a271' },
      { id: 'cherry', label: 'Cherry', hex: '#a66848' },
      { id: 'walnut', label: 'Walnut', hex: '#5a3e2b' },
      { id: 'ebonised', label: 'Ebonised', hex: '#2c2622' },
    ],
  },
  {
    id: 'plastic',
    label: 'Plastic',
    colourTitle: 'Colour',
    colours: PAINT,
    anyColour: true,
    finishes: true,
    roughness: 0.45,
    metalness: 0,
  },
  {
    id: 'concrete',
    label: 'Concrete',
    colourTitle: 'Tone',
    anyColour: false,
    finishes: false,
    roughness: 0.95,
    metalness: 0,
    colours: [
      { id: 'light', label: 'Light', hex: '#c1bdb7' },
      { id: 'mid', label: 'Mid', hex: '#a29e97' },
      { id: 'dark', label: 'Dark', hex: '#6e6a65' },
    ],
  },
  {
    id: 'stone',
    label: 'Stone',
    colourTitle: 'Stone',
    anyColour: false,
    finishes: false,
    roughness: 0.35,
    metalness: 0,
    colours: [
      { id: 'whiteMarble', label: 'White marble', hex: '#eeece8' },
      { id: 'travertine', label: 'Travertine', hex: '#dac8a9' },
      { id: 'greenMarble', label: 'Green marble', hex: '#334a3e' },
      { id: 'blackGranite', label: 'Black granite', hex: '#1e1e1e' },
    ],
  },
  {
    id: 'metal',
    label: 'Metal',
    colourTitle: 'Metal',
    anyColour: false,
    finishes: false,
    roughness: 0.35,
    metalness: 1,
    colours: [
      { id: 'brushedSteel', label: 'Brushed steel', hex: '#bcbfc2' },
      { id: 'blackSteel', label: 'Black steel', hex: '#38393b' },
      { id: 'brass', label: 'Brass', hex: '#c6a35b' },
      { id: 'copper', label: 'Copper', hex: '#bb7a56' },
      { id: 'corten', label: 'Corten', hex: '#854a2a' },
    ],
  },
  {
    id: 'acrylic',
    label: 'Acrylic',
    colourTitle: 'Tint',
    anyColour: true,
    finishes: false,
    roughness: 0.05,
    metalness: 0,
    opacity: 0.35,
    colours: [
      { id: 'clear', label: 'Clear', hex: '#e4edf3' },
      { id: 'frosted', label: 'Frosted', hex: '#e7ebee' },
      { id: 'smoke', label: 'Smoke', hex: '#707070' },
      ...PAINT.slice(6).map((c) => ({ ...c, id: `${c.id}Tint`, label: `${c.label} tint` })),
    ],
  },
  {
    id: 'mirror',
    label: 'Mirror',
    colourTitle: 'Finish',
    anyColour: false,
    finishes: false,
    roughness: 0.04,
    metalness: 1,
    colours: [
      { id: 'silver', label: 'Silver', hex: '#dfe3e7' },
      { id: 'smoked', label: 'Smoked', hex: '#6f757b' },
      { id: 'gold', label: 'Gold', hex: '#d6b56a' },
    ],
  },
]

export const pedestalMaterial = (id: string): PedestalMaterial =>
  PEDESTAL_MATERIALS.find((m) => m.id === id) ?? PEDESTAL_MATERIALS[0]

/** A finish's roughness for Painted / Plastic. */
export const FINISH_ROUGHNESS: Record<PedestalFinish, number> = {
  matte: 0.9,
  satin: 0.55,
  gloss: 0.2,
}

/** Edges: the bevel radius (cm) at the outline's corners and the top's rim. */
export const EDGE_RADIUS: Record<PedestalEdges, number> = { sharp: 0, soft: 0.6, round: 2.5 }

/** Default for a new pedestal (owner: Painted, White, Matte). */
export const PEDESTAL_DEFAULT_LOOK = {
  material: 'painted' as const,
  colour: 'white',
  finish: 'matte' as PedestalFinish,
  edges: 'soft' as PedestalEdges,
}
